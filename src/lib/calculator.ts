export type ProfileType = 'PP' | 'PGS' | 'PZ'

export interface CalculatorInput {
  profileType: ProfileType
  thickness: number
  wallHeight: number
  shelfWidthA: number
  shelfWidthB: number
  flangeC: number
  pricePerTon: number
}

interface MaterialData {
  t: number
  rb: number
  rollWidth: number
  specificWeight: number
}

export interface CalculationResult {
  rollWidth: number
  razvertka: number
  countFromRoll: number
  wasteMm: number
  wastePercentage: number
  weightPerMeter: number
  priceNoWaste: number
  priceWithWaste: number
  specificWeight: number
}

const MATERIALS: Record<string, MaterialData> = {
  '1': { t: 1.0, rb: 3.0, rollWidth: 1250, specificWeight: 7.5056 },
  '1.2': { t: 1.2, rb: 3.2, rollWidth: 1250, specificWeight: 9.2304 },
  '1.5': { t: 1.5, rb: 3.5, rollWidth: 1250, specificWeight: 11.852 },
  '2': { t: 2.0, rb: 4.0, rollWidth: 1250, specificWeight: 15.67696 },
  '2.5': { t: 2.5, rb: 4.5, rollWidth: 1000, specificWeight: 19.62 },
  '3': { t: 3.0, rb: 5.0, rollWidth: 1000, specificWeight: 23.5 },
}

function getMaterialData(thickness: number): MaterialData {
  const key = Number(thickness).toString()
  const material = MATERIALS[key]
  if (!material) {
    throw new Error(`Unsupported thickness: ${thickness}`)
  }
  return material
}

export function calculateExactResult(input: CalculatorInput): CalculationResult {
  const material = getMaterialData(input.thickness)
  const t = material.t
  const rb = material.rb

  let bendsCount = 0
  let l1 = 0

  switch (input.profileType) {
    case 'PP':
      bendsCount = 2
      l1 = (input.wallHeight - 2 * (rb + t)) + 2 * (input.shelfWidthA - (rb + t))
      break
    case 'PGS':
      bendsCount = 4
      l1 = (input.wallHeight - 2 * (rb + t)) + 2 * (input.shelfWidthA - 2 * (rb + t)) + 2 * (input.flangeC - (rb + t))
      break
    case 'PZ':
      bendsCount = 4
      l1 = (input.wallHeight - 2 * (rb + t)) + (input.shelfWidthA - 2 * (rb + t)) + (input.shelfWidthB - 2 * (rb + t)) + 2 * (input.flangeC - (rb + t))
      break
    default:
      throw new Error('Unsupported profile type')
  }

  const rcp = rb + t / 2
  const l0 = bendsCount * (Math.PI * rcp / 2)
  const razvertka = l0 + l1

  const countFromRoll = material.rollWidth > 0 ? Math.floor(material.rollWidth / razvertka) : 0
  const wasteMm = material.rollWidth > 0 ? material.rollWidth - countFromRoll * razvertka : 0
  const wastePercentage = material.rollWidth > 0 ? (wasteMm / material.rollWidth) * 100 : 100
  const weightPerMeter = (razvertka / 1000) * material.specificWeight

  const pricePerKg = input.pricePerTon / 1000
  const priceNoWaste = weightPerMeter * pricePerKg
  const rollPricePerM = material.specificWeight * (material.rollWidth / 1000) * pricePerKg
  const priceWithWaste = countFromRoll > 0 ? rollPricePerM / countFromRoll : priceNoWaste

  return {
    rollWidth: material.rollWidth,
    razvertka,
    countFromRoll,
    wasteMm,
    wastePercentage,
    weightPerMeter,
    priceNoWaste,
    priceWithWaste,
    specificWeight: material.specificWeight,
  }
}
