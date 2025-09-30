import { sendDebugText } from './realtimeClient';

export type ChatUIMode = 'sound' | 'text';

export function initChatUI(mode: ChatUIMode = 'sound') {
    let root = document.getElementById('chat-box') as HTMLDivElement | null;
    if (!root) {
        root = document.createElement('div');
        root.id = 'chat-box';
        root.style.position = 'fixed';
        root.style.right = '8px';
        root.style.bottom = '8px';
        root.style.zIndex = '10000';
        root.style.background = 'rgba(0,0,0,0.55)';
        root.style.color = '#fff';
        root.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
        root.style.fontSize = '12px';
        root.style.lineHeight = '1.35';
        root.style.padding = '8px 10px';
        root.style.borderRadius = '8px';
        root.style.maxWidth = '40vw';
        root.style.pointerEvents = 'auto';

        const title = document.createElement('div');
        title.textContent = 'Chat';
        title.style.fontWeight = '600';
        title.style.marginBottom = '6px';
        root.appendChild(title);

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '6px';
        row.style.alignItems = 'center';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type message...';
        input.style.flex = '1 1 auto';
        input.style.border = '1px solid #666';
        input.style.borderRadius = '4px';
        input.style.padding = '6px 8px';
        input.style.background = 'rgba(30,30,30,0.8)';
        input.style.color = '#fff';

        const sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        sendBtn.style.flex = '0 0 auto';
        sendBtn.style.border = '1px solid #666';
        sendBtn.style.borderRadius = '4px';
        sendBtn.style.padding = '6px 10px';
        sendBtn.style.background = 'rgba(50,50,50,0.9)';
        sendBtn.style.color = '#fff';

        row.appendChild(input);
        row.appendChild(sendBtn);
        root.appendChild(row);

        const feed = document.createElement('div');
        feed.id = 'chat-box-feed';
        feed.style.marginTop = '6px';
        feed.style.maxHeight = '28vh';
        feed.style.overflow = 'auto';
        root.appendChild(feed);

        document.body.appendChild(root);

        const append = (who: 'You' | 'AI', text: string) => {
            const line = document.createElement('div');
            line.style.opacity = who === 'You' ? '0.95' : '0.9';
            line.textContent = `${who}: ${text}`;
            feed.appendChild(line);
            feed.scrollTop = feed.scrollHeight;
        };

        const handler = async () => {
            const text = (input.value || '').trim();
            if (!text) return;
            input.value = '';
            append('You', text);
            try {
                if (mode === 'text') {
                    const { sendTextMessage } = await import('./textChatClient');
                    const reply = await sendTextMessage(text);
                    if (reply) append('AI', reply);
                } else {
                    // Relay into realtime session (audio+text)
                    sendDebugText(text);
                }
            } catch (err: any) {
                append('AI', `Error: ${String(err?.message || err)}`);
            }
        };

        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handler(); });
        sendBtn.addEventListener('click', handler);
    }
}


