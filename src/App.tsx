import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { calculateExactResult, type CalculationResult, type ProfileType } from './lib/calculator'

const formSchema = z.object({
  profileType: z.enum(['PP', 'PGS', 'PZ']),
  thickness: z.number().refine((v) => [1, 1.2, 1.5, 2, 2.5, 3].includes(v), 'Недопустимая толщина'),
  wallHeight: z.number().min(100, 'Высота: 100-350 мм').max(350, 'Высота: 100-350 мм'),
  shelfWidthA: z.number().min(40, 'Полка A: 40-100 мм').max(100, 'Полка A: 40-100 мм'),
  shelfWidthB: z.number().min(40, 'Полка B: 40-95 мм').max(95, 'Полка B: 40-95 мм'),
  flangeC: z.number().min(13, 'Отгибка C: 13-27 мм').max(27, 'Отгибка C: 13-27 мм'),
  pricePerTon: z.number().positive('Цена должна быть больше 0'),
})

type FormData = z.infer<typeof formSchema>

const thicknessOptions = [1, 1.2, 1.5, 2, 2.5, 3]
const wallHeightTicks = Array.from({ length: 26 }, (_, index) => 100 + index * 10)
const shelfWidthTicks = Array.from({ length: 13 }, (_, index) => 40 + index * 5)
const flangeMin = 13
const flangeMax = 27

interface WasteMapCell {
  wallHeight: number
  shelfWidthA: number
  wastePercentage: number
}

function format(value: number, digits = 2): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function labelByProfile(type: ProfileType): string {
  if (type === 'PP') return 'ПП'
  if (type === 'PGS') return 'ПГС'
  return 'ПZ'
}

function formatThickness(value: number): string {
  return Number(value).toFixed(1).replace('.', ',')
}

function getWasteColor(wastePercentage: number): string {
  if (wastePercentage <= 5) return '#dcfce7'
  if (wastePercentage <= 10) return '#fef9c3'
  if (wastePercentage <= 20) return '#fed7aa'
  if (wastePercentage <= 35) return '#fecdd3'
  return '#fda4af'
}

function getWasteTextColor(wastePercentage: number): string {
  return wastePercentage > 35 ? '#881337' : '#0f172a'
}

function buildProfileName(params: {
  profileType: ProfileType
  wallHeight: number
  shelfWidthA: number
  shelfWidthB: number
  flangeC: number
  thickness: number
}): string {
  const { profileType, wallHeight, shelfWidthA, shelfWidthB, flangeC, thickness } = params
  const profile = labelByProfile(profileType)
  const t = formatThickness(thickness)

  if (profileType === 'PP') {
    return `${profile} ${wallHeight}x${shelfWidthA} без перфор. ${t} (Оцинк.)`
  }

  if (profileType === 'PGS') {
    return `${profile} ${wallHeight}x${shelfWidthA}x${flangeC} без перфор. ${t} (Оцинк.)`
  }

  return `${profile} ${wallHeight}x${shelfWidthA}x${shelfWidthB}x${flangeC} без перфор. ${t} (Оцинк.)`
}

export default function App() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      profileType: 'PP',
      thickness: 1.2,
      wallHeight: 200,
      shelfWidthA: 60,
      shelfWidthB: 60,
      flangeC: 15,
      pricePerTon: 160000,
    },
  })

  const watchedValues = useWatch({ control })
  const profileType = watchedValues.profileType ?? 'PP'
  const showShelfB = profileType === 'PZ'
  const showFlangeC = profileType !== 'PP'
  const flangeCValue = Number(watchedValues.flangeC ?? flangeMin)
  const selectedThickness = Number(watchedValues.thickness ?? 0)

  const normalizedValues = useMemo(() => {
    const parsed = formSchema.safeParse(watchedValues)
    if (!parsed.success) return null

    return {
      ...parsed.data,
      shelfWidthB: parsed.data.profileType === 'PZ' ? parsed.data.shelfWidthB : parsed.data.shelfWidthA,
      flangeC: parsed.data.profileType === 'PP' ? 0 : parsed.data.flangeC,
    }
  }, [watchedValues])

  const calculation = useMemo<{ result: CalculationResult | null; serverError: string }>(() => {
    if (!normalizedValues) return { result: null, serverError: '' }

    try {
      return { result: calculateExactResult(normalizedValues), serverError: '' }
    } catch (error) {
      return {
        result: null,
        serverError: error instanceof Error ? error.message : 'Не удалось выполнить расчет',
      }
    }
  }, [normalizedValues])

  const { result, serverError } = calculation

  const wasteState = useMemo(() => {
    if (!result) return 'neutral'
    return result.wastePercentage > 5 ? 'danger' : 'good'
  }, [result])

  const wasteMap = useMemo(() => {
    if (!normalizedValues) return []

    return wallHeightTicks.map((wallHeight) =>
        shelfWidthTicks.map<WasteMapCell>((shelfWidthA) => {
          const next = calculateExactResult({
            ...normalizedValues,
            wallHeight,
            shelfWidthA,
            shelfWidthB: normalizedValues.profileType === 'PZ' ? normalizedValues.shelfWidthB : shelfWidthA,
          })

          return {
            wallHeight,
            shelfWidthA,
            wastePercentage: next.wastePercentage,
          }
        }),
      )
  }, [normalizedValues])

  function applyGraphCell(cell: WasteMapCell) {
    setValue('wallHeight', cell.wallHeight, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    setValue('shelfWidthA', cell.shelfWidthA, { shouldDirty: true, shouldTouch: true, shouldValidate: true })

    if (profileType !== 'PZ') {
      setValue('shelfWidthB', cell.shelfWidthA, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,#eff6ff,transparent_40%),radial-gradient(circle_at_90%_0%,#fee2e2,transparent_35%),#f8fafc] px-4 py-8 font-sans text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur">
          <h1 className="font-['Exo_2'] text-2xl font-bold leading-tight sm:text-3xl">Калькулятор профилей ИНСИ</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">Параметры</h2>
            <form className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Тип профиля</span>
                <select className="input" {...register('profileType')}>
                  <option value="PP">ПП</option>
                  <option value="PGS">ПГС</option>
                  <option value="PZ">ПZ</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Толщина, мм</span>
                <select className="input" {...register('thickness', { valueAsNumber: true })}>
                  {thicknessOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Высота стенки, мм</span>
                <input className="input" type="number" {...register('wallHeight', { valueAsNumber: true })} />
                {errors.wallHeight && <p className="field-error">{errors.wallHeight.message}</p>}
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Полка A, мм</span>
                <input className="input" type="number" {...register('shelfWidthA', { valueAsNumber: true })} />
                {errors.shelfWidthA && <p className="field-error">{errors.shelfWidthA.message}</p>}
              </label>

              {showShelfB && (
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700">Полка B, мм</span>
                  <input className="input" type="number" {...register('shelfWidthB', { valueAsNumber: true })} />
                  {errors.shelfWidthB && <p className="field-error">{errors.shelfWidthB.message}</p>}
                </label>
              )}

              {showFlangeC && (
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700">Отгибка C, мм</span>
                  <input className="input" type="number" {...register('flangeC', { valueAsNumber: true })} />
                  {errors.flangeC && <p className="field-error">{errors.flangeC.message}</p>}
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Цена за тонну, руб.</span>
                <input className="input" type="number" {...register('pricePerTon', { valueAsNumber: true })} />
                {errors.pricePerTon && <p className="field-error">{errors.pricePerTon.message}</p>}
              </label>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Результат</h2>
              {result && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    wasteState === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {wasteState === 'danger' ? 'Отход > 5%' : 'Отход <= 5%'}
                </span>
              )}
            </div>

            {serverError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                {serverError}
              </div>
            )}

            {!result && !serverError && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Измените параметры в форме: расчет выполняется автоматически.
              </div>
            )}

            {result && (
              <div
                className={`space-y-4 rounded-2xl p-3 ${
                  wasteState === 'danger'
                    ? 'border border-rose-200 bg-rose-50'
                    : 'border border-emerald-200 bg-emerald-50'
                }`}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Профиль</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {buildProfileName({
                      profileType,
                      wallHeight: Number(watchedValues.wallHeight),
                      shelfWidthA: Number(watchedValues.shelfWidthA),
                      shelfWidthB: Number(watchedValues.shelfWidthB),
                      flangeC: Number(watchedValues.flangeC),
                      thickness: Number(watchedValues.thickness),
                    })}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Развертка" value={`${format(result.razvertka)} мм`} />
                  <MetricCard label="Количество из рулона" value={`${format(result.countFromRoll, 0)} шт`} />
                  <MetricCard label="Отход" value={`${format(result.wasteMm)} мм`} />
                  <MetricCard label="Отход, %" value={`${format(result.wastePercentage)} %`} />
                  <MetricCard label="Вес 1 пог.м" value={`${format(result.weightPerMeter, 3)} кг`} />
                  <MetricCard label="Ширина рулона" value={`${format(result.rollWidth, 0)} мм`} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Цена без отхода</p>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">{format(result.priceNoWaste)} руб/м</p>
                  </div>
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Цена с отходом</p>
                    <p className="mt-2 text-2xl font-extrabold text-indigo-900">{format(result.priceWithWaste)} руб/м</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-2 text-lg font-bold">Подбор выгодного профиля</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-800">
                {labelByProfile(profileType)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                t {formatThickness(selectedThickness)} мм
              </span>
              {showFlangeC && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900">
                  C {format(flangeCValue, 0)} мм
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700">
              <span className="rounded-full bg-emerald-100 px-3 py-1">0-5%</span>
              <span className="rounded-full bg-yellow-100 px-3 py-1">5-10%</span>
              <span className="rounded-full bg-orange-100 px-3 py-1">10-20%</span>
              <span className="rounded-full bg-rose-100 px-3 py-1">&gt;20%</span>
            </div>
          </div>
          <p className="mb-4 text-xs font-medium text-slate-500">
            X: полка A, Y: высота стенки. Клик по ячейке подставляет размеры в расчет.
          </p>

          {!normalizedValues && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Для графика нужны корректные параметры расчета.
            </div>
          )}

          {normalizedValues && (
            <div>
              {showFlangeC && (
                <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor="graphFlangeC" className="text-sm font-extrabold text-amber-900">
                      Отгибка C
                    </label>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-slate-900 shadow-sm">
                      {format(flangeCValue, 0)} мм
                    </span>
                  </div>
                  <input
                    id="graphFlangeC"
                    className="w-full accent-amber-600"
                    type="range"
                    min={flangeMin}
                    max={flangeMax}
                    step={1}
                    value={flangeCValue}
                    onChange={(event) => {
                      setValue('flangeC', Number(event.target.value), {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }}
                  />
                  <div className="mt-2 flex justify-between text-xs font-bold text-slate-500">
                    <span>{flangeMin} мм</span>
                    <span>{flangeMax} мм</span>
                  </div>
                </div>
              )}

              <div>
                <table className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-12 px-1 py-2 text-right text-[9px] font-bold uppercase text-slate-500 sm:w-16 sm:text-xs">
                      Высота
                    </th>
                    {shelfWidthTicks.map((shelfWidth) => (
                      <th key={shelfWidth} className="px-0.5 py-2 text-center text-[9px] font-bold uppercase text-slate-500 sm:text-xs">
                        {shelfWidth}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wasteMap.map((row) => (
                    <tr key={row[0].wallHeight}>
                      <th className="px-1 py-1 text-right text-[9px] font-bold text-slate-500 sm:text-xs">{row[0].wallHeight}</th>
                      {row.map((cell) => {
                        const isSelected =
                          cell.wallHeight === normalizedValues.wallHeight && cell.shelfWidthA === normalizedValues.shelfWidthA

                        return (
                          <td key={`${cell.wallHeight}-${cell.shelfWidthA}`} className="p-0.5">
                            <button
                              className={`flex h-7 w-full cursor-pointer items-center justify-center rounded-md border text-[9px] font-extrabold transition hover:scale-[1.03] hover:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 sm:h-8 sm:rounded-lg sm:text-xs ${
                                isSelected ? 'border-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,0.16)]' : 'border-white'
                              }`}
                              type="button"
                              onClick={() => applyGraphCell(cell)}
                              style={{
                                backgroundColor: getWasteColor(cell.wastePercentage),
                                color: getWasteTextColor(cell.wastePercentage),
                              }}
                              title={`Высота ${cell.wallHeight} мм, полка ${cell.shelfWidthA} мм: ${format(cell.wastePercentage)}%`}
                            >
                              {format(cell.wastePercentage, 1)}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
                <p className="mt-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Полка A, мм</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

interface MetricCardProps {
  label: string
  value: string
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}
