import { useEffect, useRef } from 'react'
import type { BotProps } from 'growtheffect-embed'

type Props = BotProps & {
  style?: React.CSSProperties
  className?: string
  enableInboxStream?: boolean
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'growtheffect-fullchatbot': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { class?: string }
    }
  }
}

type FullPageChatElement = HTMLElement & BotProps

export const FullPageChat = ({
  style,
  className,
  enableInboxStream = true,
  ...assignableProps
}: Props) => {
  const ref = useRef<FullPageChatElement | null>(null)

  useEffect(() => {
    ;(async () => {
      await import('growtheffect-embed/dist/web.js')
    })()
  }, [])

  useEffect(() => {
    if (!ref.current) return
    Object.assign(ref.current, assignableProps)
  }, [assignableProps])

  // Subscribe to operator inbox SSE and forward messages to embed as humanMessage
  useEffect(() => {
    if (!enableInboxStream) return
    const element = ref.current
    if (!element) return

    const chatflowid = assignableProps.chatflowid
    const apiHost = assignableProps.apiHost || window.location.origin
    if (!chatflowid || !apiHost) return

    // Try to infer chatId from storage (best-effort)
    const getChatId = (): string | null => {
      // Common patterns we use; try a few keys and then scan
      const candidates = [
        `ge_chat_${chatflowid}`,
        `${chatflowid}_chat`,
        `${chatflowid}_chatId`,
        chatflowid,
      ]
      for (const key of candidates) {
        const raw = window.localStorage.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw)
          if (parsed?.chatId && typeof parsed.chatId === 'string') return parsed.chatId
        } catch {
          // if plain string, maybe it's the id itself
          if (typeof raw === 'string' && raw.length > 0) return raw
        }
      }
      // Fallback: scan all localStorage entries looking for an object with chatId
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (!key) continue
          const raw = window.localStorage.getItem(key)
          if (!raw) continue
          try {
            const parsed = JSON.parse(raw)
            if (parsed?.chatId && typeof parsed.chatId === 'string') return parsed.chatId
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
      return null
    }

    let es: EventSource | null = null
    let connected = false
    let interval: number | null = null

    const tryConnect = () => {
      if (connected) return
      const chatId = getChatId()
      if (!chatId) return

      const url = `${apiHost.replace(/\/$/, '')}/api/v1/inbox/stream/${encodeURIComponent(
        chatflowid
      )}?chatId=${encodeURIComponent(chatId)}`
      try {
        es = new EventSource(url)
        connected = true
      } catch {
        return
      }

      const handleMessage = (evt: MessageEvent) => {
        // Server sends JSON with shape { event, data }
        try {
          const payload = JSON.parse(evt.data)
          const eventType = payload?.event
          const data = payload?.data
          if (eventType === 'operatorMessage') {
            const text: string | undefined = data?.content ?? data?.text ?? data?.message
            if (typeof text === 'string' && text.length > 0) {
              // Dispatch a CustomEvent that embed can handle, and try common imperative hooks if exposed
              const detail = { type: 'humanMessage', text }
              element.dispatchEvent(new CustomEvent('operatorMessage', { detail }))
              const anyEl = element as any
              for (const fn of [
                'addExternalHumanMessage',
                'addHumanMessage',
                'appendUserMessage',
                'pushMessage',
              ]) {
                if (typeof anyEl?.[fn] === 'function') {
                  try {
                    anyEl[fn](text, 'humanMessage')
                    break
                  } catch {
                    // ignore and try next
                  }
                }
              }
            }
          }
        } catch {
          // ignore malformed messages
        }
      }

      es.onmessage = handleMessage
      es.onerror = () => {
        // Allow browser to handle reconnects; no-op
      }
    }

    // Try immediately, then poll briefly for chatId to appear
    tryConnect()
    if (!connected) {
      let attempts = 0
      interval = window.setInterval(() => {
        attempts += 1
        tryConnect()
        if (connected || attempts > 40) {
          if (interval) window.clearInterval(interval)
          interval = null
        }
      }, 500)
    }

    return () => {
      if (interval) window.clearInterval(interval)
      interval = null
      try {
        es?.close()
      } catch {
        // ignore
      }
    }
  }, [enableInboxStream, assignableProps.chatflowid, assignableProps.apiHost])

  return <growtheffect-fullchatbot ref={ref} style={style} class={className} />
}
