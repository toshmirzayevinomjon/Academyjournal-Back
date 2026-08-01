async function readApiError(response: Response) {
  try {
    const body = await response.json()
    if (Array.isArray(body.detail)) return body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(' ')
    return body.detail || "So'rov bajarilmadi."
  } catch { return "So'rov bajarilmadi." }
}

export async function api<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...fetchOptions } = options
  const headers: Record<string, string> = {
    ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string> || {}),
  }
  const r = await fetch(path, { ...fetchOptions, headers })
  if (!r.ok) throw new Error(await readApiError(r))
  if (r.status === 204) return undefined as T
  return r.json() as Promise<T>
}
