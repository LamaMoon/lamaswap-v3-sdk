import { ChainId, CurrencyAmount, ETHER, Percent, Token, TradeType, WETH9 } from '@lamamoon/swap-sdk-core'
import { FeeAmount, TICK_SPACINGS } from './constants'
import { Pool } from './entities/pool'
import { SwapRouter } from './swapRouter'
import { nearestUsableTick, TickMath } from './utils'
import { encodeSqrtRatioX96 } from './utils/encodeSqrtRatioX96'
import { Route, Trade } from './entities'
import JSBI from 'jsbi'

describe('SwapRouter', () => {
  const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
  const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')

  const feeAmount = FeeAmount.MEDIUM
  const sqrtRatioX96 = encodeSqrtRatioX96(1, 1)
  const liquidity = 1_000_000

  const pool_0_1 = new Pool(
    token0,
    token1,
    feeAmount,
    sqrtRatioX96,
    liquidity,
    TickMath.getTickAtSqrtRatio(sqrtRatioX96),
    [
      {
        index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: liquidity,
        liquidityGross: liquidity
      },
      {
        index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: -liquidity,
        liquidityGross: liquidity
      }
    ]
  )
  const WETH = WETH9[ChainId.MAINNET]
  const pool_1_weth = new Pool(
    token1,
    WETH,
    feeAmount,
    sqrtRatioX96,
    liquidity,
    TickMath.getTickAtSqrtRatio(sqrtRatioX96),
    [
      {
        index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: liquidity,
        liquidityGross: liquidity
      },
      {
        index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: -liquidity,
        liquidityGross: liquidity
      }
    ]
  )

  const slippageTolerance = new Percent(1, 100)
  const recipient = '0x0000000000000000000000000000000000000003'
  const deadline = 123

  describe('#swapCallParameters', () => {
    it('single-hop exact input', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_0_1], token0, token1),
        CurrencyAmount.fromRawAmount(token0, 100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0x414bf389000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000610000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('single-hop exact output', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_0_1], token0, token1),
        CurrencyAmount.fromRawAmount(token1, 100),
        TradeType.EXACT_OUTPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0xdb3e2198000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000670000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('multi-hop exact input', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_0_1, pool_1_weth], token0, WETH),
        CurrencyAmount.fromRawAmount(token0, 100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0xc04b8d59000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000005f00000000000000000000000000000000000000000000000000000000000000420000000000000000000000000000000000000001000bb80000000000000000000000000000000000000002000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('multi-hop exact output', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_0_1, pool_1_weth], token0, WETH),
        CurrencyAmount.fromRawAmount(WETH, 100),
        TradeType.EXACT_OUTPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0xf28c0498000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000690000000000000000000000000000000000000000000000000000000000000042c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000bb80000000000000000000000000000000000000002000bb80000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('ETH in exact input', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_1_weth], ETHER, token1),
        CurrencyAmount.ether(100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0x414bf389000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000610000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x64')
    })

    it('ETH in exact output', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_1_weth], ETHER, token1),
        CurrencyAmount.fromRawAmount(token1, 100),
        TradeType.EXACT_OUTPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0xac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000104db3e2198000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000007b00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000067000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000412210e8a00000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x67')
    })

    it('ETH out exact input', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_1_weth], token1, ETHER),
        CurrencyAmount.fromRawAmount(token1, 100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0xac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000104414bf3890000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000061000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c0000000000000000000000000000000000000000000000000000000000000061000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('ETH out exact output', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_1_weth], token1, ETHER),
        CurrencyAmount.ether(100),
        TradeType.EXACT_OUTPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline
      })

      expect(calldata).toBe(
        '0xac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000104db3e21980000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000067000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('sqrtPriceLimitX96', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_0_1], token0, token1),
        CurrencyAmount.fromRawAmount(token0, 100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline,
        sqrtPriceLimitX96: JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128))
      })

      expect(calldata).toBe(
        '0x414bf389000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000610000000000000000000000000000000100000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('fee with eth out', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_1_weth], token1, ETHER),
        CurrencyAmount.fromRawAmount(token1, 100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline,
        fee: {
          fee: new Percent(5, 1000),
          recipient
        }
      })

      expect(calldata).toBe(
        '0xac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000104414bf3890000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000006100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000849b2c0a37000000000000000000000000000000000000000000000000000000000000006100000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })
    it('fee', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_0_1], token0, token1),
        CurrencyAmount.fromRawAmount(token0, 100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance,
        recipient,
        deadline,
        fee: {
          fee: new Percent(5, 1000),
          recipient
        }
      })

      expect(calldata).toBe(
        '0xac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000104414bf389000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000006100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a4e0e189a00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006100000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })
  })
})
