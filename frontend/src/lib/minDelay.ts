/** Мінімальна тривалість показу процесу (лише фронт): CV відповідає за ~100 мс, людина цього не помітить. Бекенд не сповільнюємо. */
export const MIN_PROCESS_MS = 1000

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Чекає і результат, і мінімальний час; помилка проходить одразу без очікування. */
export async function withMinDuration<T>(work: Promise<T>, ms = MIN_PROCESS_MS): Promise<T> {
  const [result] = await Promise.all([work, sleep(ms)])
  return result
}
