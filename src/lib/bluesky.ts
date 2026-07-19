import { AtpAgent } from '@atproto/api'
import type { BlueskySession, Note, NoteRecord } from '../types'
import { NOTE_COLLECTION } from '../types'
import { saveSession } from './storage'

const DEFAULT_SERVICE = 'https://bsky.social'

let agent: AtpAgent | null = null

function getAgent(service = DEFAULT_SERVICE): AtpAgent {
  if (!agent || agent.service.toString() !== new URL(service).toString()) {
    agent = new AtpAgent({ service })
  }
  return agent
}

export async function loginWithAppPassword(
  identifier: string,
  password: string,
  service = DEFAULT_SERVICE,
): Promise<BlueskySession> {
  const current = getAgent(service)
  const result = await current.login({
    identifier: identifier.trim(),
    password: password.trim(),
  })

  if (!result.success || !current.session) {
    throw new Error('ログインに失敗しました')
  }

  const session: BlueskySession = {
    did: current.session.did,
    handle: current.session.handle,
    accessJwt: current.session.accessJwt,
    refreshJwt: current.session.refreshJwt,
    service,
  }
  saveSession(session)
  return session
}

export async function resumeSession(session: BlueskySession): Promise<boolean> {
  const current = getAgent(session.service)
  try {
    await current.resumeSession({
      did: session.did,
      handle: session.handle,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
      active: true,
    })
    if (current.session) {
      saveSession({
        did: current.session.did,
        handle: current.session.handle,
        accessJwt: current.session.accessJwt,
        refreshJwt: current.session.refreshJwt,
        service: session.service,
      })
      return true
    }
    return false
  } catch {
    saveSession(null)
    return false
  }
}

export function logout(): void {
  agent = null
  saveSession(null)
}

function toRecord(note: Note): NoteRecord {
  return {
    $type: NOTE_COLLECTION,
    id: note.id,
    title: note.title,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

function fromListRecord(item: {
  uri: string
  value: unknown
}): Note | null {
  const value = item.value as Partial<NoteRecord>
  if (!value || typeof value.id !== 'string') return null
  const rkey = item.uri.split('/').pop()
  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : '',
    body: typeof value.body === 'string' ? value.body : '',
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
    rkey,
  }
}

export async function fetchRemoteNotes(): Promise<Note[]> {
  const current = getAgent()
  if (!current.session) throw new Error('未ログインです')

  const notes: Note[] = []
  let cursor: string | undefined

  do {
    const res = await current.com.atproto.repo.listRecords({
      repo: current.session.did,
      collection: NOTE_COLLECTION,
      limit: 100,
      cursor,
    })
    for (const item of res.data.records) {
      const note = fromListRecord(item)
      if (note) notes.push(note)
    }
    cursor = res.data.cursor
  } while (cursor)

  return notes
}

export async function upsertRemoteNote(note: Note): Promise<Note> {
  const current = getAgent()
  if (!current.session) throw new Error('未ログインです')

  const record = toRecord(note)

  if (note.rkey) {
    await current.com.atproto.repo.putRecord({
      repo: current.session.did,
      collection: NOTE_COLLECTION,
      rkey: note.rkey,
      record,
    })
    return note
  }

  const created = await current.com.atproto.repo.createRecord({
    repo: current.session.did,
    collection: NOTE_COLLECTION,
    record,
  })
  const rkey = created.data.uri.split('/').pop()
  return { ...note, rkey }
}

export async function deleteRemoteNote(rkey: string): Promise<void> {
  const current = getAgent()
  if (!current.session) throw new Error('未ログインです')

  await current.com.atproto.repo.deleteRecord({
    repo: current.session.did,
    collection: NOTE_COLLECTION,
    rkey,
  })
}

/** Merge local and remote notes by id, keeping the newer updatedAt. */
export function mergeNotes(local: Note[], remote: Note[]): Note[] {
  const map = new Map<string, Note>()

  for (const note of local) {
    map.set(note.id, note)
  }

  for (const remoteNote of remote) {
    const existing = map.get(remoteNote.id)
    if (!existing) {
      map.set(remoteNote.id, remoteNote)
      continue
    }
    const keepRemote =
      new Date(remoteNote.updatedAt).getTime() >
      new Date(existing.updatedAt).getTime()
    map.set(remoteNote.id, {
      ...(keepRemote ? remoteNote : existing),
      rkey: remoteNote.rkey ?? existing.rkey,
    })
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export async function pushMissingNotes(notes: Note[]): Promise<Note[]> {
  const synced: Note[] = []
  for (const note of notes) {
    if (note.rkey) {
      synced.push(note)
      continue
    }
    synced.push(await upsertRemoteNote(note))
  }
  return synced
}
