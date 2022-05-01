// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import { FlashLoanReceiverBase } from "./FlashLoanReceiverBase.sol";
import { ILendingPool, ILendingPoolAddressesProvider, IERC20 } from "./Interfaces.sol";
import { SafeMath } from "./Libraries.sol";

import "hardhat/console.sol";

//import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';


interface ICToken {
    function liquidateBorrow(address borrower, uint repayAmount, address cTokenCollateral) external returns (uint);

    function redeem(uint redeemTokens) external returns (uint);
}

interface IWeth {
    function deposit() external payable;
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}


contract FlashLoan is FlashLoanReceiverBase {
    using SafeMath for uint256;

    address public cETH = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;
    address public cUSDC = 0x39AA39c021dfbaE8faC545936693aC917d5E7563;
    address public wETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public usdc = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public uniswapRouter = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    uint256 public liquidateAmount = 1300000000;

    constructor(ILendingPoolAddressesProvider _addressProvider) FlashLoanReceiverBase(_addressProvider) public {}

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    )
        external
        override
        returns (bool)
    {
        // approve and liquidate 
        IERC20(usdc).approve(cUSDC, liquidateAmount);
        ICToken(cUSDC).liquidateBorrow(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, liquidateAmount, cETH);
        
        // receive cETH after liquidate, redeem it to ETH
        ICToken(cETH).redeem(IERC20(cETH).balanceOf(address(this)));

        // 798797807581625461 is the redeem ETH amount, wrap it to WETH to swap in uniswap
        IWeth(wETH).deposit{value: 798797807581625461}();
        uint256 wethBalance = IERC20(wETH).balanceOf(address(this));

        // swap WETH to USDC in uniswap to prepare USDC for repay flashloan
        IERC20(wETH).approve(uniswapRouter, wethBalance);
        ISwapRouter.ExactInputSingleParams memory swapParams =
        ISwapRouter.ExactInputSingleParams({
            tokenIn: wETH,
            tokenOut: usdc,
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: wethBalance,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        ISwapRouter(uniswapRouter).exactInputSingle(swapParams);

        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint i = 0; i < assets.length; i++) {
            uint amountOwing = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(LENDING_POOL), amountOwing);
        }

        return true;
    }

    function flashLiquidate() public {
        address receiverAddress = address(this);

        address[] memory assets = new address[](1);
        assets[0] = address(usdc); // USDC
        

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = liquidateAmount;

        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;


        address onBehalfOf = address(this);
        bytes memory params = "";
        uint16 referralCode = 0;

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }

    receive() external payable {
        
    }
}