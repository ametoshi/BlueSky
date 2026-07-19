import { useCallback, useEffect, useState } from 'react'
import {
  deleteRemoteNote,
  fetchRemoteNotes,
  loginWithAppPassword,
  logout as blueskyLogout,
  mergeNotes,
  pushMissingNotes,
  resumeSession,
  upsertRemoteNote,
} from '../lib/bluesky'
import {
  createId,
  loadNotes,
  loadSession,
  saveNotes,
} from '../lib/storage'
import type { BlueskySession, Note } from '../types'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const [session, setSession] = useState<BlueskySession | null>(() =>
    loadSession(),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const saved = loadSession()
      if (!saved) {
        if (!cancelled) setReady(true)
        return
      }
      setBusy(true)
      setStatus('セッションを復元しています…')
      const ok = await resumeSession(saved)
      if (cancelled) return
      if (ok) {
        setSession(saved)
        setStatus('Bluesky に接続済みです')
      } else {
        setSession(null)
        setStatus('セッションの期限が切れました。再ログインしてください')
      }
      setBusy(false)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selected =
    notes.find((n) => n.id === selectedId) ?? notes[0] ?? null

  const createNote = useCallback(() => {
    const now = new Date().toISOString()
    const note: Note = {
      id: createId(),
      title: '新しいメモ',
      body: '',
      createdAt: now,
      updatedAt: now,
    }
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
    setStatus('ローカルにメモを作成しました')
    return note
  }, [])

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === id
            ? {
                ...note,
                ...patch,
                updatedAt: new Date().toISOString(),
              }
            : note,
        ),
      )
    },
    [],
  )

  const removeNote = useCallback(
    async (id: string) => {
      const target = notes.find((n) => n.id === id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (selectedId === id) setSelectedId(null)
      if (session && target?.rkey) {
        try {
          await deleteRemoteNote(target.rkey)
          setStatus('メモを削除し、Bluesky からも削除しました')
        } catch {
          setStatus('ローカルからは削除しました（リモート削除に失敗）')
        }
      } else {
        setStatus('メモを削除しました')
      }
    },
    [notes, selectedId, session],
  )

  const login = useCallback(async (handle: string, appPassword: string) => {
    setBusy(true)
    setStatus('Bluesky にログインしています…')
    try {
      const next = await loginWithAppPassword(handle, appPassword)
      setSession(next)
      setStatus(`@${next.handle} としてログインしました。同期できます`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ログインに失敗しました'
      setStatus(message)
      throw error
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(() => {
    blueskyLogout()
    setSession(null)
    setStatus('ログアウトしました。メモは端末に残っています')
  }, [])

  const sync = useCallback(async () => {
    if (!session) {
      setStatus('同期するには Bluesky にログインしてください')
      return
    }
    setBusy(true)
    setStatus('デバイス間で同期しています…')
    try {
      const remote = await fetchRemoteNotes()
      const merged = mergeNotes(notes, remote)
      const pushed = await pushMissingNotes(merged)

      // Update remotely changed notes that already have rkeys
      const finalNotes: Note[] = []
      for (const note of pushed) {
        const remoteMatch = remote.find((r) => r.id === note.id)
        const localNewer =
          !remoteMatch ||
          new Date(note.updatedAt).getTime() >
            new Date(remoteMatch.updatedAt).getTime()
        if (note.rkey && localNewer && remoteMatch) {
          finalNotes.push(await upsertRemoteNote(note))
        } else {
          finalNotes.push(note)
        }
      }

      setNotes(
        finalNotes.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
      )
      setStatus(
        `同期完了（${finalNotes.length} 件）。他の端末でも同じアカウントで同期できます`,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '同期に失敗しました'
      setStatus(message)
    } finally {
      setBusy(false)
    }
  }, [notes, session])

  const saveSelectedToCloud = useCallback(async () => {
    if (!session || !selected) {
      setStatus('保存するにはログインとメモの選択が必要です')
      return
    }
    setBusy(true)
    try {
      const saved = await upsertRemoteNote(selected)
      setNotes((prev) =>
        prev.map((n) => (n.id === saved.id ? saved : n)),
      )
      setStatus('このメモを Bluesky に保存しました')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '保存に失敗しました'
      setStatus(message)
    } finally {
      setBusy(false)
    }
  }, [selected, session])

  return {
    notes,
    selected,
    selectedId: selected?.id ?? null,
    setSelectedId,
    createNote,
    updateNote,
    removeNote,
    session,
    login,
    logout,
    sync,
    saveSelectedToCloud,
    status,
    busy,
    ready,
  }
}
