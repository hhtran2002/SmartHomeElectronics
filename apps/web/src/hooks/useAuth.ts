import { useEffect, useState } from 'react'
import type { AuthUser } from '../types'

const AUTH_STORAGE_KEY = 'aa-smart-auth'

type StoredAuth = {
  token: string
  user: AuthUser
}

function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export function useAuth() {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth())

  useEffect(() => {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
      return
    }

    localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [auth])

  function signIn(user: AuthUser, token: string) {
    setAuth({ user, token })
  }

  function signOut() {
    setAuth(null)
  }

  function updateUser(patch: Partial<AuthUser>) {
    setAuth((current) => current ? { ...current, user: { ...current.user, ...patch } } : current)
  }

  return {
    token: auth?.token ?? '',
    user: auth?.user ?? null,
    signIn,
    signOut,
    updateUser,
  }
}
