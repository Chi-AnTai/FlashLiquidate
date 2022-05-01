
const hre = require("hardhat");
const ethers = hre.ethers;
const { BigNumber } = ethers;
const { expect } = require('chai');
const comptrollerABI = require("./ABI.json");

async function main() {
    const mintAmount = BigNumber.from(10).pow(18)
    const borrowAmount = BigNumber.from(10).pow(6).mul(2600)

    const adminAddress = "0x6d903f6003cca6255d85cca4d3b5e5146dc33925";
    const cETHAddress = "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5"
    const comptrollerAddress = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b'
    const cUsdcAddress = '0x39aa39c021dfbae8fac545936693ac917d5e7563'
    const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const usdcHolderAddress = '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8';

    const accounts = await ethers.getSigners();

    const user = accounts[0]
    const liquidator = accounts[1]

    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [adminAddress],
    });
    const adminSigner = await ethers.getSigner(
        adminAddress
    );

    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [usdcHolderAddress],
    });
    const usdcSigner = await ethers.getSigner(
        usdcHolderAddress
    );

    const comptroller =  await ethers.getContractAt(comptrollerABI, comptrollerAddress);
    const cETHContract = await hre.ethers.getContractFactory("CEther");
    const cETH = cETHContract.attach(cETHAddress)

    const cTokenContract = await hre.ethers.getContractFactory("CErc20");
    const cToken = cTokenContract.attach(cUsdcAddress);

    const usdcContract = await hre.ethers.getContractFactory("CErc20");
    const usdc = usdcContract.attach(usdcAddress);

    await cETH.connect(user).mint({ value: mintAmount })
    await comptroller.connect(user).enterMarkets([cETHAddress, cUsdcAddress])

    let balance = await cETH.balanceOf(user.address)
    console.log(balance)
    let userLiquidity = await comptroller.getAccountLiquidity(user.address)
    console.log(userLiquidity)


    await cToken.connect(user).borrow(borrowAmount)
    let usdcBalance = await usdc.balanceOf(user.address)
    console.log(usdcBalance)

    userLiquidity = await comptroller.getAccountLiquidity(user.address)
    console.log(userLiquidity)


    await comptroller.connect(adminSigner)._setCollateralFactor(cETHAddress, BigNumber.from(4).mul(BigNumber.from(10).pow(17)))
    
    userLiquidity = await comptroller.getAccountLiquidity(user.address)
    console.log(userLiquidity)

    await usdc.connect(usdcSigner).transfer(liquidator.address, borrowAmount)
    let liquidatorUsdcBalance = await usdc.balanceOf(liquidator.address)
    console.log('liquidatorUsdcBalance', liquidatorUsdcBalance)
    await usdc.connect(liquidator).approve(cToken.address, borrowAmount);

    let balanceBeforeLiquidate = await cETH.balanceOf(user.address)
    // await cToken.connect(liquidator).liquidateBorrow(user.address, borrowAmount.div(2), cETH.address)
    let balanceAfterLiquidate = await cETH.balanceOf(user.address)

    userLiquidity = await comptroller.getAccountLiquidity(user.address)
    console.log(userLiquidity)

    console.log('balanceBeforeLiquidate', balanceBeforeLiquidate)
    console.log('balanceAfterLiquidate', balanceAfterLiquidate)

    console.log('user', user.address)
    console.log('cToken', cToken.address)

    // await deplpyFlashLoan()
    const flashLoanContract =  await hre.ethers.getContractFactory("FlashLoan");
    const flashLoan = await flashLoanContract.deploy('0xb53c1a33016b2dc2ff3653530bff1848a515c8c5')
    console.log('deploy success',flashLoan.address )

    await usdc.connect(usdcSigner).transfer(flashLoan.address, borrowAmount)
    await flashLoan.myFlashLoanCall()

    const ethBalance = await ethers.provider.getBalance(flashLoan.address)
    console.log('ethBalance', ethBalance)
    const cETHBalance = await cETH.balanceOf(flashLoan.address)
    console.log('cETHBalance', cETHBalance)







}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});
