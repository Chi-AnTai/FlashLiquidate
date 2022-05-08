pragma solidity ^0.5.16;

import "./ERC721.sol";

contract CERC721 is ERC721 {
    bool public constant isCToken = true;
    bool public constant isERC721 = true;
    address public underlying;
    uint public initialExchangeRateMantissa = 1e18;
    string public symbol = 'CERC721';

    constructor(address _underlying) public {
        underlying = _underlying;
    }

    function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint) {
        // bytes memory data = delegateToViewImplementation(abi.encodeWithSignature("getAccountSnapshot(address)", account));
        // return abi.decode(data, (uint, uint, uint, uint));
        uint cTokenBalance = uint(balanceOf(account));
        return (0, cTokenBalance, 0, initialExchangeRateMantissa);
    }

    function accrueInterest() public returns (uint) {
        return 0;
    }

    function accrualBlockNumber() public returns (uint) {
        return block.number;
    }

    function exchangeRateStored() public view returns (uint) {
        return 1e18;
    }

    function mint(uint256 tokenId) public {
        IERC721(underlying).safeTransferFrom(msg.sender, address(this), tokenId);
        _safeMint(msg.sender, tokenId);
    }

    function seize(address liquidator, address borrower, uint tokenId) external returns (uint) {
        _transferFrom(borrower, liquidator, tokenId);
    }

    function onERC721Received(address _operator, address _from, uint256 _tokenId, bytes calldata _data) external returns(bytes4) {
        return 0x150b7a02;
    }
}