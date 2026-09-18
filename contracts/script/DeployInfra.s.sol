// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ChainlinkPriceOracle, IAggregatorV3} from "../src/adapters/ChainlinkPriceOracle.sol";
import {UniswapV3SwapExecutor, ISwapRouter02} from "../src/adapters/UniswapV3SwapExecutor.sol";

/// @notice Step 1 on Robinhood Chain: the oracle and swap executor DeployProduction points at.
///         Feeds are Chainlink's Robinhood Chain aggregators; fee tiers are the deepest
///         USDG pool on Uniswap v3 for each Stock Token (measured, not assumed).
contract DeployInfra is Script {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;

    struct Leg {
        string symbol;
        address token;
        address feed;
        uint24 fee;
    }

    function legs() internal pure returns (Leg[] memory l) {
        l = new Leg[](12);
        l[0] = Leg("NVDA", 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15, 500);
        l[1] = Leg("AMD", 0x86923f96303D656E4aa86D9d42D1e57ad2023fdC, 0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72, 3000);
        l[2] = Leg("TSM", 0x58FfE4a942d3885bAa22D7520691F611EF09e7AA, 0x874cF94aa8eC88Fd9560094dD065f2fB3E41Fc2F, 10000);
        l[3] = Leg("ASML", 0x47F93d52cBeC7C6D2CfC080e154002370a60dAEA, 0xB4106147E8cce40b7d46124090d373A71b70f87D, 10000);
        l[4] = Leg("MU", 0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD, 0x425EEFdCf05ed6526C3cE61Af99429A228a6d596, 3000);
        l[5] = Leg("INTC", 0xc72b96e0E48ecd4DC75E1e45396e26300BC39681, 0x3f390C5C24628Ac7C489515402235FeAD71D1913, 3000);
        l[6] = Leg("SLV", 0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f, 0x209b73908e92Ae021826eD79609845451Ecba2ce, 3000);
        l[7] = Leg("USO", 0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344, 0x75a9c76Ef439e2C7c2E5a34Ab105EcFe3766431c, 3000);
        l[8] = Leg("GME", 0x1b0E319c6A659F002271B69dB8A7df2F911c153E, 0x27C71df6A64fB476468EdF256CF72c038baB5B67, 10000);
        l[9] = Leg("MSTR", 0xec262a75e413fAfD0dF80480274532C79D42da09, 0x396118bdFB181e6240E74D243F266B061c0edc3D, 10000);
        l[10] = Leg("PLTR", 0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A, 0x820ABedFF239034956B7A9d2F0a331f9F075eB4c, 3000);
        l[11] = Leg("TSLA", 0x322F0929c4625eD5bAd873c95208D54E1c003b2d, 0x4A1166a659A55625345e9515b32adECea5547C38, 3000);
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        Leg[] memory l = legs();

        vm.startBroadcast(pk);
        ChainlinkPriceOracle oracle = new ChainlinkPriceOracle(deployer);
        UniswapV3SwapExecutor exec = new UniswapV3SwapExecutor(deployer, ISwapRouter02(SWAP_ROUTER_02));
        for (uint256 i; i < l.length; ++i) {
            oracle.setFeed(l[i].token, IAggregatorV3(l[i].feed));
            exec.setFeeTier(USDG, l[i].token, l[i].fee);
            (uint256 p, uint256 at) = oracle.getPrice(l[i].token);
            console.log(l[i].symbol, p, block.timestamp - at);
        }
        vm.stopBroadcast();

        vm.writeFile(
            "./deployments/infra.json",
            string.concat(
                '{"chainId":', vm.toString(block.chainid), ',"oracle":"', vm.toString(address(oracle)),
                '","swapExecutor":"', vm.toString(address(exec)), '"}'
            )
        );
        console.log("ORACLE", address(oracle));
        console.log("SWAP_EXECUTOR", address(exec));
    }
}
