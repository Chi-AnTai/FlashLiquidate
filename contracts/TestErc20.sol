// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestErc20 is ERC20 {
    constructor() ERC20("TestToken", "TT") {
        uint256 total = 1000000000;
        _mint(msg.sender, total * 10**uint256(decimals()));
    }

    // function decimals() public view virtual override returns (uint8) {
    //     // 預設是18
    //     return 2;
    // }
}