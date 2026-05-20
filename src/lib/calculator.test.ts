import { describe, expect, it } from 'vitest'
import { calculateExactResult } from './calculator'

describe('calculateExactResult', () => {
  it('calculates PP profile metrics and price correctly', () => {
    const result = calculateExactResult({
      profileType: 'PP',
      thickness: 1.2,
      wallHeight: 200,
      shelfWidthA: 60,
      shelfWidthB: 60,
      flangeC: 0,
      pricePerTon: 160000,
    })

    expect(result.rollWidth).toBe(1250)
    expect(result.countFromRoll).toBe(3)
    expect(result.razvertka).toBeCloseTo(314.338, 3)
    expect(result.wasteMm).toBeCloseTo(306.986, 3)
    expect(result.wastePercentage).toBeCloseTo(24.559, 3)
    expect(result.weightPerMeter).toBeCloseTo(2.901, 3)
    expect(result.priceNoWaste).toBeCloseTo(464.23, 2)
    expect(result.priceWithWaste).toBeCloseTo(615.36, 3)
  })

  it('throws when thickness is not supported', () => {
    expect(() =>
      calculateExactResult({
        profileType: 'PP',
        thickness: 9.9,
        wallHeight: 200,
        shelfWidthA: 60,
        shelfWidthB: 60,
        flangeC: 0,
        pricePerTon: 160000,
      }),
    ).toThrow(/Unsupported thickness/)
  })
})
