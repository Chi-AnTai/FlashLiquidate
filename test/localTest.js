const { expect } = require("chai");
const hre = require("hardhat");
const ethers = hre.ethers;
const { BigNumber, utils } = ethers;
const { parseEther, formatEther } = utils;

const mintAmount = parseEther('100')
const oraclePrice = parseEther('3000')

async function deployComptroller() {
    const comptrollerContract = await hre.ethers.getContractFactory("Comptroller");
    const comptroller = await comptrollerContract.deploy();
    console.log("comptroller deploy success: ", comptroller.address);
    return comptroller
}

async function deployInterestContract() {
    const interestContract = await hre.ethers.getContractFactory("JumpRateModel");
    const interestModal = await interestContract.deploy(parseEther('1'), parseEther('1'), parseEther('1'), parseEther('1'))
    console.log('interset modal deploy success', interestModal.address)
    return interestModal
}

async function deploycETH(comptrollerAddress, interestModalAddress, deployerAddress) {
    const cETHContract = await hre.ethers.getContractFactory("CEther");
    const cETH = await cETHContract.deploy(comptrollerAddress, interestModalAddress, parseEther('1'), 'Compound ETH', 'cETH', 18, deployerAddress)
    console.log('cETH address', cETH.address)
    return cETH
}

async function deployErc20(comptrollerAddress, interestModalAddress, deployerAddress) {
    const TestErc20 = await hre.ethers.getContractFactory("TestErc20");
    const erc20 = await TestErc20.deploy()
    const CErc20Contract = await hre.ethers.getContractFactory("CErc20");
    const cErc20 = await CErc20Contract.deploy()
    await cErc20['initialize(address,address,address,uint256,string,string,uint8)'](erc20.address, comptrollerAddress, interestModalAddress, parseEther('1'), 'CErc20', 'CERC', 18)

    return {
        erc20,
        cErc20
    }
}

async function deployOracle(erc20Address) {
    const oracleContract = await hre.ethers.getContractFactory("SimplePriceOracle");
    const oracle = await oracleContract.deploy()
    await oracle.setDirectPrice('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', oraclePrice)
    await oracle.setDirectPrice(erc20Address, oraclePrice)
    return oracle
}

describe("Deploy Test", function () {
    let accounts;
    let deployer;
    let comptroller
    let interestModal
    let cETH
    let oracle
    let erc20
    let cerc20;
    let depositor2

    async function checkLiquidation() {
        let deployerLiquidity = await comptroller.getAccountLiquidity(deployer.address)
        if (deployerLiquidity[2].gt(0)) {
            console.log('on check liquidity: liquidity is not enough, must liquidate')
            let balanceBeforeLiquidate = await cETH.balanceOf(deployer.address)
            await cerc20.connect(depositor2).liquidateBorrow(deployer.address, mintAmount.div(5), cETH.address)
            let balanceAfterLiquidate = await cETH.balanceOf(deployer.address)
            console.log('balanceBeforeLiquidate', formatEther(balanceBeforeLiquidate))
            console.log('balanceAfterLiquidate', formatEther(balanceAfterLiquidate))
        } else {
            console.log('on check liquidity: liquidity is sufficient')
        }
    }

    this.beforeAll("Set accounts", async () => {
        // get deployer account
        accounts = await ethers.getSigners();
        deployer = accounts[0]
        depositor2 = accounts[1]
    });

    this.beforeAll("Deploy", async () => {
        comptroller = await deployComptroller()
        interestModal = await deployInterestContract()
        cETH = await deploycETH(comptroller.address, interestModal.address, deployer.address)
        const { erc20: erc, cErc20: cerc } = await deployErc20(comptroller.address, interestModal.address, deployer.address)
        erc20 = erc
        cerc20 = cerc
        oracle = await deployOracle(erc20.address)
        console.log('Deploy success')
    })

    this.beforeAll("Set parameter", async () => {
        await comptroller._setPriceOracle(oracle.address)

        await comptroller._supportMarket(cETH.address)
        await comptroller.enterMarkets([cETH.address])
        
        await comptroller._supportMarket(cerc20.address)
        await comptroller.enterMarkets([cerc20.address])

        await comptroller._setCollateralFactor(cETH.address, BigNumber.from(8).mul(BigNumber.from(10).pow(17)))
        await comptroller._setCollateralFactor(cerc20.address, BigNumber.from(8).mul(BigNumber.from(10).pow(17)))

        await comptroller._setCloseFactor(parseEther('0.8'))
        await comptroller._setLiquidationIncentive(parseEther('1.5'))
        console.log('Set parameter success')
    })

    it('Liquidity check start', async () => {
        setInterval(() => {
            checkLiquidation(comptroller, deployer)
        }, 4000);
    })

    it("Able to mint erc20", async () => {
        await erc20.transfer(depositor2.address, mintAmount.mul(10))
        await erc20.connect(depositor2).approve(cerc20.address, mintAmount.mul(10))
        await cerc20.connect(depositor2).mint(mintAmount.mul(2))
    })

    it("Able to mint cETH", async function () {
        await cETH.mint({ value: mintAmount })
    })

    it("Able to borrow", async function () {
        let erc20BeforeBorrow = await erc20.balanceOf(deployer.address)
        await cerc20.borrow(mintAmount.div(2))
        let erc20AfterBorrow = await erc20.balanceOf(deployer.address)
        // console.log('cerc20BeforeBorrow', erc20BeforeBorrow)
        // console.log('cerc20AfterBorrow', erc20AfterBorrow)
        
    })
    it('Check liquidity', async () => {
        let deployerLiquidity = await comptroller.getAccountLiquidity(deployer.address)
        console.log('liquidity before price change',deployerLiquidity.toString())
    })

    it('change oracle price', async () => {
        await oracle.setDirectPrice('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', oraclePrice.div(2))

        await new Promise(resolve => setTimeout(resolve, 10000));
    })
});
