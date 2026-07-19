import type { BlueskySession, Note } from '../types'

const NOTES_KEY = 'bluesky.notes.v1'
const SESSION_KEY = 'bluesky.session.v1'

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Note[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveNotes(notes: Note[]): void {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

export function loadSession(): BlueskySession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BlueskySession
  } catch {
    return null
  }
}

export function saveSession(session: BlueskySession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
