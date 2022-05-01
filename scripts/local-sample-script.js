
const hre = require("hardhat");
const ethers = hre.ethers;
const { BigNumber } = ethers;
const { expect } = require('chai');

const mintAmount = BigNumber.from(10).pow(8)
const borrowAmount = BigNumber.from(10).pow(6)
const redeemAmount = BigNumber.from(10).pow(3)
const oraclePrice = 10000

async function deployComptroller() {
    const comptrollerContract = await hre.ethers.getContractFactory("Comptroller");
    const comptroller = await comptrollerContract.deploy();
    console.log("comptroller deploy success: ", comptroller.address);
    return comptroller
}

async function deployInterestContract() {
    const interestContract = await hre.ethers.getContractFactory("JumpRateModel");
    const interestModal = await interestContract.deploy(1, 1, 1, 1)
    console.log('interset modal deploy success', interestModal.address)
    return interestModal
}

async function deploycETH(comptrollerAddress, interestModalAddress, deployerAddress) {
    const cETHContract = await hre.ethers.getContractFactory("CEther");
    const cETH = await cETHContract.deploy(comptrollerAddress, interestModalAddress, 1, 'Compound ETH', 'cETH', 8, deployerAddress)
    console.log('cETH address', cETH.address)
    return cETH
}

// async function deployCToken(comptrollerAddress, interestModalAddress, deployerAddress) {
//     // const erc20Contract = await hre.ethers.getContractFactory("ERC20Harness");
//     // const erc20 = await erc20Contract.deploy(10000, 'ERC20 OMG', 18, 'OMG')
//     // const cDelegateeContract = await hre.ethers.getContractFactory("CErc20DelegateHarness");
//     // const cDelegatee = cDelegateeContract.deploy()
//     // const cDelegatorContract = await hre.ethers.getContractFactory("CErc20Delegator");
//     // const cDelegator = await cDelegatorContract.deploy(erc20.address, comptrollerAddress, interestModalAddress, 1, 'ERC20 OMG','OMG', 18,  deployerAddress, (await cDelegatee).address, '0x0')
//     // const cToken = await hre.ethers.getContractAt('CErc20DelegateHarness', cDelegator.address);
//     // return cToken

//     const erc20Token = await hre.ethers.getContractFactory("TestErc20");
//     const erc20 = await erc20Token.deploy()
//     const cErc20Contract = await hre.ethers.getContractFactory("CErc20");
//     const cToken = await cErc20Contract.deploy()
//     await cToken.initialize(erc20.address, comptrollerAddress, interestModalAddress, 1, 'ERC20 OMG','OMG', 18)

//     return cToken
// }

async function deployOracle() {
    const oracleContract = await hre.ethers.getContractFactory("SimplePriceOracle");
    const oracle = await oracleContract.deploy()
    await oracle.setDirectPrice('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', oraclePrice)
    return oracle
}

async function main() {
    // get deployer account
    const accounts = await ethers.getSigners();
    const deployer = accounts[0]

    // deploy contract
    const comptroller = await deployComptroller()
    const interestModal = await deployInterestContract()
    const cETH = await deploycETH(comptroller.address, interestModal.address, deployer.address)
    const oracle = await deployOracle()

    // set comptroller variable
    await comptroller._setPriceOracle(oracle.address)
    await comptroller._supportMarket(cETH.address)
    await comptroller.enterMarkets([cETH.address])
    await comptroller._setCollateralFactor(cETH.address, BigNumber.from(8).mul(BigNumber.from(10).pow(17)))
    
    // able to mint cETH
    await cETH.mint({ value: mintAmount })
    let balance = await cETH.balanceOf(deployer.address)
    expect(balance).to.be.equal(mintAmount.mul(BigNumber.from(10).pow(18)));
    console.log('cETH mint success')

    // able to borrow cETH
    let ethBalanceBeforeBorrow = await ethers.provider.getBalance(deployer.address)
    await cETH.borrow(1)
    console.log('cETH borrow success')
    let ethBalanceAfterBorrow = await ethers.provider.getBalance(deployer.address)
    expect(parseInt(ethBalanceBeforeBorrow.toString().slice(-1))).to.be.equal(parseInt(ethBalanceAfterBorrow.toString().slice(-1)) - 1)

    // able to repay cETH
    await cETH.repayBorrow({value: 1})
    balance = await cETH.balanceOf(deployer.address)
    expect(balance).to.be.equal(mintAmount.mul(BigNumber.from(10).pow(18)));
    console.log('cETH repay success')

    // able to redeem cETH
    await cETH.redeem(redeemAmount)
    balance = await cETH.balanceOf(deployer.address)
    expect(balance).to.be.equal(mintAmount.mul(BigNumber.from(10).pow(18)).sub(redeemAmount));
    console.log('cETH redeem success')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});
