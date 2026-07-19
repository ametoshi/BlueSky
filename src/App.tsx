import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNotes } from './hooks/useNotes'
import './App.css'

function App() {
  const {
    notes,
    selected,
    selectedId,
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
  } = useNotes()

  const [handle, setHandle] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [showLogin, setShowLogin] = useState(false)

  async function onLogin(event: FormEvent) {
    event.preventDefault()
    setLoginError('')
    try {
      await login(handle, appPassword)
      setAppPassword('')
      setShowLogin(false)
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : 'ログインに失敗しました',
      )
    }
  }

  function scrollToNotes() {
    document.getElementById('notes')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-sky" aria-hidden="true" />
        <div className="hero-mist" aria-hidden="true" />
        <nav className="topbar">
          <span className="topbar-mark">ブルースカイ</span>
          {session ? (
            <button type="button" className="ghost" onClick={logout}>
              @{session.handle}
            </button>
          ) : (
            <button
              type="button"
              className="ghost"
              onClick={() => setShowLogin(true)}
            >
              ログイン
            </button>
          )}
        </nav>

        <div className="hero-copy">
          <p className="brand">ブルースカイ</p>
          <h1>メモを、空のようにどこでも。</h1>
          <p className="lede">
            Bluesky
            アカウントで端末をまたいでメモを同期できる、シンプルなノートです。
          </p>
          <div className="cta-row">
            <button type="button" className="primary" onClick={scrollToNotes}>
              メモを書く
            </button>
            {session ? (
              <button
                type="button"
                className="secondary"
                onClick={() => void sync()}
                disabled={busy || !ready}
              >
                今すぐ同期
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => setShowLogin(true)}
              >
                Bluesky で同期
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section id="notes" className="notes-section">
          <div className="section-head">
            <h2>メモ</h2>
            <p>この端末に保存され、ログイン後は Bluesky 経由で共有できます。</p>
          </div>

          <div className="notes-layout">
            <aside className="note-list" aria-label="メモ一覧">
              <button
                type="button"
                className="primary compact"
                onClick={createNote}
              >
                新しいメモ
              </button>
              <ul>
                {notes.length === 0 && (
                  <li className="empty">まだメモがありません</li>
                )}
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      className={
                        note.id === selectedId ? 'note-item active' : 'note-item'
                      }
                      onClick={() => setSelectedId(note.id)}
                    >
                      <span className="note-title">
                        {note.title || '無題のメモ'}
                      </span>
                      <span className="note-meta">
                        {new Date(note.updatedAt).toLocaleString('ja-JP')}
                        {note.rkey ? ' · 同期済' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="editor" aria-label="メモ編集">
              {selected ? (
                <>
                  <input
                    className="title-input"
                    value={selected.title}
                    onChange={(e) =>
                      updateNote(selected.id, { title: e.target.value })
                    }
                    placeholder="タイトル"
                    aria-label="タイトル"
                  />
                  <textarea
                    className="body-input"
                    value={selected.body}
                    onChange={(e) =>
                      updateNote(selected.id, { body: e.target.value })
                    }
                    placeholder="ここにメモを書く…"
                    aria-label="本文"
                  />
                  <div className="editor-actions">
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => void saveSelectedToCloud()}
                      disabled={!session || busy}
                    >
                      Bluesky に保存
                    </button>
                    <button
                      type="button"
                      className="danger compact"
                      onClick={() => void removeNote(selected.id)}
                    >
                      削除
                    </button>
                  </div>
                </>
              ) : (
                <div className="editor-empty">
                  <p>左の一覧からメモを選ぶか、新しいメモを作成してください。</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="sync" className="sync-section">
          <div className="section-head">
            <h2>別デバイスとの共有</h2>
            <p>
              同じ Bluesky アカウントでログインし、「今すぐ同期」を押すとメモが揃います。
            </p>
          </div>

          <div className="sync-panel">
            {session ? (
              <>
                <p className="sync-state">
                  接続中: <strong>@{session.handle}</strong>
                </p>
                <div className="cta-row">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void sync()}
                    disabled={busy}
                  >
                    今すぐ同期
                  </button>
                  <button type="button" className="ghost" onClick={logout}>
                    ログアウト
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="sync-state">
                  未接続です。アプリパスワードでログインすると、スマホと PC
                  などで同じメモを共有できます。
                </p>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setShowLogin(true)}
                >
                  Bluesky にログイン
                </button>
              </>
            )}

            <ol className="howto">
              <li>
                Bluesky の設定から{' '}
                <a
                  href="https://bsky.app/settings/app-passwords"
                  target="_blank"
                  rel="noreferrer"
                >
                  アプリパスワード
                </a>{' '}
                を作成する
              </li>
              <li>このアプリにハンドルとアプリパスワードでログインする</li>
              <li>別の端末でも同じアカウントでログインし、同期する</li>
            </ol>
          </div>

          {status && (
            <p className="status" role="status">
              {status}
            </p>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>ブルースカイ</span>
        <span>メモは端末に保存され、任意で Bluesky に同期されます</span>
      </footer>

      {showLogin && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="login-title">Bluesky ログイン</h2>
            <p>
              アプリパスワードを使用します。通常のアカウントパスワードは入力しないでください。
            </p>
            <form onSubmit={onLogin}>
              <label>
                ハンドル
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="you.bsky.social"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                アプリパスワード
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  autoComplete="current-password"
                  required
                />
              </label>
              {loginError && <p className="form-error">{loginError}</p>}
              <div className="cta-row">
                <button type="submit" className="primary" disabled={busy}>
                  ログイン
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowLogin(false)}
                >
                  閉じる
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
