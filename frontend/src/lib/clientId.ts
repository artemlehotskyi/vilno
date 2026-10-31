// Анонімний id клієнта для ліміту скарг (авторизації немає). Лише в localStorage цього браузера.
const KEY = 'vilno.clientId'

export function getClientId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    // crypto.randomUUID недоступний по http з телефона в LAN, getRandomValues — доступний
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(KEY, id)
  }
  return id
}
