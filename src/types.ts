export type Note = {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
  rkey?: string
}

export type BlueskySession = {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
  service: string
}

export const NOTE_COLLECTION = 'com.github.ametoshi.bluesky.note' as const

export type NoteRecord = {
  $type: typeof NOTE_COLLECTION
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}
