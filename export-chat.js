// ==============================================================
// Upwork Chat Exporter - Browser Console Script
// ==============================================================
//
// INSTRUCTIONS:
// 1. Open the Upwork conversation you want to export in Chrome
// 2. SCROLL UP to load ALL messages (hold Page Up or scroll manually)
// 3. Open DevTools (F12) -> Console tab
// 4. Paste this entire script and press Enter
// 5. The conversation will be downloaded as a .txt file
//
// ==============================================================

(function() {
  'use strict';

  const chatTitle = document.querySelector('[data-test="room-title"]')?.textContent?.trim() || 'Upwork Chat';
  const chatSubtitle = document.querySelector('[data-test="room-subtitle"]')?.textContent?.trim() || '';

  // Get all story items (messages, system events, date headers)
  const storyItems = document.querySelectorAll('.up-d-story-item');

  if (storyItems.length === 0) {
    console.error('No messages found. Make sure you are on an Upwork conversation page.');
    return;
  }

  const lines = [];
  lines.push('='.repeat(60));
  lines.push(`UPWORK CONVERSATION: ${chatTitle}`);
  if (chatSubtitle) lines.push(`${chatSubtitle}`);
  lines.push(`Exported: ${new Date().toLocaleString()}`);
  lines.push(`Messages found: ${storyItems.length}`);
  lines.push('='.repeat(60));
  lines.push('');

  let lastSender = '';

  storyItems.forEach((item) => {
    // Check for date header
    const dateHeader = item.querySelector('.story-day-header');
    if (dateHeader) {
      const dateText = dateHeader.textContent?.trim();
      if (dateText) {
        lines.push('');
        lines.push(`--- ${dateText} ---`);
        lines.push('');
      }
    }

    const story = item.querySelector('[data-test="story-container"]');
    if (!story) return;

    // Check if this is a "top" message (first from this sender, shows avatar/name)
    const storyInner = item.querySelector('.story-inner');
    const isTopMessage = storyInner?.classList.contains('top');

    // Try to get sender name
    let sender = '';
    if (isTopMessage) {
      // The avatar section might have a title or alt text with the name
      const avatar = item.querySelector('.up-d-avatar');
      const avatarImg = avatar?.querySelector('img');
      sender = avatarImg?.alt || avatar?.getAttribute('title') || '';

      // Also try to get name from aria-label or other text elements near avatar
      if (!sender) {
        const nameEl = item.querySelector('.story-sender-name, .user-name, .username, [class*="sender"], [class*="user-name"]');
        sender = nameEl?.textContent?.trim() || '';
      }

      // Try avatar id which might contain user info
      if (!sender && avatar?.id) {
        const match = avatar.id.match(/user_(.+?)_avatar/);
        if (match && match[1] !== 'undefined') {
          sender = match[1];
        }
      }

      // Fallback: check the story inner for any text that looks like a name before the message
      if (!sender) {
        const storySection = item.querySelector('.story-section');
        if (storySection) {
          // Look for text nodes or elements before the story-message
          const childNodes = storySection.childNodes;
          for (const node of childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
              sender = node.textContent.trim();
              break;
            }
            if (node.classList && !node.classList.contains('story-message') && node.textContent.trim()) {
              const text = node.textContent.trim();
              if (text.length < 50 && !text.includes('\n')) {
                sender = text;
                break;
              }
            }
          }
        }
      }

      if (sender) lastSender = sender;
    }

    // Get timestamp
    const timeEl = item.querySelector('time, [class*="timestamp"], [class*="time"], .story-time');
    const timestamp = timeEl?.textContent?.trim() || timeEl?.getAttribute('datetime') || '';

    // Get message content
    const messageEl = item.querySelector('[data-test="story-message"]');
    if (!messageEl) {
      // Check for system messages (contract started, etc.)
      const systemMsg = story.textContent?.trim();
      if (systemMsg && systemMsg.length > 0 && systemMsg.length < 500) {
        lines.push(`[SYSTEM] ${systemMsg}`);
      }
      return;
    }

    let messageText = '';

    // Process message content preserving structure
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();

      // Skip end-of-message marker
      if (node.classList?.contains('end-of-message')) return '';

      if (tag === 'br') return '\n';
      if (tag === 'p') {
        const inner = Array.from(node.childNodes).map(processNode).join('');
        return inner + '\n';
      }
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        const text = node.textContent || '';
        return href && href !== text ? `${text} (${href})` : text;
      }
      if (tag === 'pre' || tag === 'code') {
        return '`' + node.textContent + '`';
      }
      if (tag === 'strong' || tag === 'b') {
        return '**' + node.textContent + '**';
      }
      if (tag === 'em' || tag === 'i') {
        return '_' + node.textContent + '_';
      }
      if (tag === 'img') {
        return `[Image: ${node.alt || node.src || ''}]`;
      }
      if (tag === 'ul' || tag === 'ol') {
        return Array.from(node.children).map((li, i) => {
          const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
          return prefix + li.textContent.trim();
        }).join('\n') + '\n';
      }

      return Array.from(node.childNodes).map(processNode).join('');
    };

    messageText = processNode(messageEl).trim();

    if (!messageText) return;

    // Format the output line
    const senderLabel = isTopMessage && lastSender ? lastSender : lastSender;

    if (isTopMessage) {
      lines.push(`[${senderLabel}]${timestamp ? ' (' + timestamp + ')' : ''}`);
    }
    lines.push(messageText);
    if (isTopMessage) lines.push('');
  });

  // Build final text
  const output = lines.join('\n');

  // Download as file
  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `upwork-chat-${chatTitle.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Exported ${storyItems.length} messages from "${chatTitle}"`);
  console.log('File downloaded!');

  // Also copy to clipboard
  navigator.clipboard.writeText(output).then(() => {
    console.log('Also copied to clipboard!');
  }).catch(() => {
    console.log('(Could not copy to clipboard - check the downloaded file)');
  });
})();
