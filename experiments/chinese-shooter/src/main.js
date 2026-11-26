import { DECK } from './cards.js'

// ── Canvas setup ──────────────────────────────────────────────────────────────
const W = 390, H = 680
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H)
  canvas.style.width  = `${W * s}px`
  canvas.style.height = `${H * s}px`
}
window.addEventListener('resize', resize)
resize()

// ── Constants ─────────────────────────────────────────────────────────────────
const SHIP_Y       = H - 70
const BUBBLE_BAND  = { top: 160, bottom: 390 }   // y range bubbles drift in
const BUBBLE_R     = 48
const BULLET_SPEED = 9
const SHIP_SPEED   = 5.5
const NUM_OPTIONS  = 3                            // 3 bubbles per question

// ── Helpers ───────────────────────────────────────────────────────────────────
function pick(arr, n) {
  const copy = [...arr]; const out = []
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function shuffleOptions(card) {
  // Pick correct + (NUM_OPTIONS-1) distractors
  const distractors = pick(card.distractors, NUM_OPTIONS - 1)
  const opts = [card.correct, ...distractors]
  // Fisher-Yates
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]]
  }
  return opts
}

// Shuffle deck and pick cards for this run
function buildRun() {
  const copy = [...DECK]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, 10)   // 10 questions per run
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r,   r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,     y + h, x, y + h - r,   r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x,     y,     x + r, y,       r)
  ctx.closePath()
}

// ── State ─────────────────────────────────────────────────────────────────────
let phase      = 'start'
let run        = []        // cards for this run
let runIdx     = 0
let bubbles    = []        // { x, y, vx, vy, text, isCorrect, hit, hitTimer }
let bullets    = []        // { x, y }
let shipX      = W / 2
let targetBubble = null    // bubble currently being aimed at (held)
let score      = 0
let streak     = 0
let flashColor = ''
let flashAlpha = 0
let feedback   = null      // { text, color }
let feedTimer  = 0
let time       = 0

// ── Bubble spawning ───────────────────────────────────────────────────────────
function spawnBubbles(card) {
  const opts = shuffleOptions(card)
  bubbles = opts.map((text, i) => {
    // Spread evenly across x, random y in band
    const x  = (W / (NUM_OPTIONS + 1)) * (i + 1)
    const y  = BUBBLE_BAND.top + Math.random() * (BUBBLE_BAND.bottom - BUBBLE_BAND.top)
    const spd = 0.5 + Math.random() * 0.6
    const ang = Math.random() * Math.PI * 2
    return {
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.4,   // gentle vertical drift
      text,
      isCorrect: text === card.correct,
      hit: false,
      hitTimer: 0,
    }
  })
}

function nextCard() {
  if (runIdx >= run.length) { phase = 'done'; return }
  targetBubble = null
  bullets = []
  feedback = null
  feedTimer = 0
  spawnBubbles(run[runIdx++])
  phase = 'playing'
}

function startGame() {
  run    = buildRun()
  runIdx = 0
  score  = 0
  streak = 0
  shipX  = W / 2
  nextCard()
}

// ── Input helpers ─────────────────────────────────────────────────────────────
function getCanvasPos(clientX, clientY) {
  const r = canvas.getBoundingClientRect()
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top)  * (H / r.height),
  }
}

function bubbleAt(x, y) {
  return bubbles.find(b => !b.hit && Math.hypot(b.x - x, b.y - y) < BUBBLE_R + 10)
}

function onPress(x, y) {
  if (phase === 'start') { startGame(); return }
  if (phase === 'done')  {
    // play-again button zone
    if (Math.abs(x - W / 2) < 90 && y > H * 0.65 && y < H * 0.65 + 54) startGame()
    return
  }
  if (phase !== 'playing') return
  const b = bubbleAt(x, y)
  targetBubble = b || null
}

function onRelease() { targetBubble = null }

// Mouse
canvas.addEventListener('mousedown', e => { const p = getCanvasPos(e.clientX, e.clientY); onPress(p.x, p.y) })
canvas.addEventListener('mouseup',   onRelease)
canvas.addEventListener('mouseleave', onRelease)

// Touch
canvas.addEventListener('touchstart', e => {
  e.preventDefault()
  const p = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY)
  onPress(p.x, p.y)
}, { passive: false })
canvas.addEventListener('touchend',    e => { e.preventDefault(); onRelease() }, { passive: false })
canvas.addEventListener('touchcancel', e => { e.preventDefault(); onRelease() }, { passive: false })

// Keyboard fallback: left/right move ship, space shoots nearest bubble
document.addEventListener('keydown', e => {
  if (phase === 'start') { startGame(); return }
})

// ── Update ────────────────────────────────────────────────────────────────────
let lastTs = 0, bulletCooldown = 0

function update(dt) {
  time += dt
  flashAlpha = Math.max(0, flashAlpha - 0.025 * (dt / 16))
  if (feedTimer > 0) feedTimer -= dt

  if (phase !== 'playing') return

  // ── Ship movement ──
  if (targetBubble && !targetBubble.hit) {
    const dx = targetBubble.x - shipX
    const step = SHIP_SPEED * (dt / 16)
    shipX += Math.sign(dx) * Math.min(Math.abs(dx), step)
  }
  shipX = Math.max(24, Math.min(W - 24, shipX))

  // ── Bubble drift ──
  for (const b of bubbles) {
    if (b.hit) { b.hitTimer -= dt; continue }
    b.x += b.vx * (dt / 16)
    b.y += b.vy * (dt / 16)
    // Bounce off walls
    if (b.x < BUBBLE_R)     { b.x = BUBBLE_R;     b.vx *= -1 }
    if (b.x > W - BUBBLE_R) { b.x = W - BUBBLE_R; b.vx *= -1 }
    if (b.y < BUBBLE_BAND.top)    { b.y = BUBBLE_BAND.top;    b.vy *= -1 }
    if (b.y > BUBBLE_BAND.bottom) { b.y = BUBBLE_BAND.bottom; b.vy *= -1 }
  }

  // ── Bullets ──
  bulletCooldown -= dt
  if (targetBubble && !targetBubble.hit && bulletCooldown <= 0) {
    bullets.push({ x: shipX, y: SHIP_Y - 28 })
    bulletCooldown = 120   // ms between shots
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= BULLET_SPEED * (dt / 16)
    if (bullets[i].y < -20) { bullets.splice(i, 1); continue }

    // Collision with bubbles
    for (const b of bubbles) {
      if (b.hit) continue
      if (Math.hypot(bullets[i].x - b.x, bullets[i].y - b.y) < BUBBLE_R) {
        bullets.splice(i, 1)
        b.hit = true
        b.hitTimer = 500
        scoreHit(b)
        break
      }
    }
  }

  // After all bubbles resolved, advance
  if (bubbles.every(b => b.hit && b.hitTimer <= 0)) {
    setTimeout(nextCard, 200)
  }
}

function scoreHit(b) {
  if (b.isCorrect) {
    streak++
    const mult = streak >= 4 ? 6 : streak >= 3 ? 4 : streak >= 2 ? 2 : 1
    score += 100 * mult
    flashColor  = '#00e676'
    flashAlpha  = 0.3
    feedback    = { text: streak >= 2 ? `Correct!  ×${mult}` : 'Correct!', color: '#00ff88' }
    feedTimer   = 1200
    targetBubble = null
    // Pop remaining bubbles after short delay
    setTimeout(() => { bubbles.forEach(bub => { if (!bub.hit) { bub.hit = true; bub.hitTimer = 1 } }) }, 300)
  } else {
    streak     = 0
    score      = Math.max(0, score - 50)
    flashColor = '#ff1744'
    flashAlpha = 0.3
    feedback   = { text: 'Wrong!  −50', color: '#ff5566' }
    feedTimer  = 900
    targetBubble = null
  }
}

// ── Prompt text ───────────────────────────────────────────────────────────────
function promptFor(card) {
  if (card.type === 'zh-en') return { big: card.zh, sub: card.py, label: 'What does it mean?' }
  if (card.type === 'en-zh') return { big: card.en, sub: null,   label: 'Pick the Chinese' }
  return { big: card.sentence, sub: card.hint, label: 'Fill in the blank' }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawBg() {
  ctx.fillStyle = '#0d0d1a'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#151525'
  ctx.lineWidth = 1
  const sp = 35
  for (let i = 0; i <= H / sp + 1; i++) {
    const y = ((time * 0.06 + i * sp) % H)
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
}

function drawQuestion(card) {
  ctx.fillStyle   = '#10102a'
  roundRect(10, 10, W - 20, 125, 12)
  ctx.fill()
  ctx.strokeStyle = '#2a2a5a'
  ctx.lineWidth   = 1.5
  ctx.stroke()

  ctx.textAlign = 'center'

  if (feedTimer > 0 && feedback) {
    ctx.font      = 'bold 24px sans-serif'
    ctx.fillStyle = feedback.color
    ctx.fillText(feedback.text, W / 2, 76)
    return
  }

  const p = promptFor(card)
  const isBig = p.big.length <= 4
  ctx.font      = `bold ${isBig ? 50 : 26}px sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.fillText(p.big, W / 2, isBig ? 74 : 65)
  if (p.sub) {
    ctx.font      = '17px sans-serif'
    ctx.fillStyle = '#7788cc'
    ctx.fillText(p.sub, W / 2, isBig ? 100 : 92)
  }
  ctx.font      = '13px sans-serif'
  ctx.fillStyle = '#445566'
  ctx.fillText(p.label, W / 2, 123)
}

function drawBubbles() {
  for (const b of bubbles) {
    const alpha = b.hit ? Math.max(0, b.hitTimer / 500) : 1
    ctx.globalAlpha = alpha

    // Glow ring when this is the aimed bubble
    if (b === targetBubble && !b.hit) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth   = 2.5
      ctx.beginPath(); ctx.arc(b.x, b.y, BUBBLE_R + 6, 0, Math.PI * 2); ctx.stroke()
    }

    // Fill
    const grad = ctx.createRadialGradient(b.x - 10, b.y - 10, 4, b.x, b.y, BUBBLE_R)
    grad.addColorStop(0, b.hit ? (b.isCorrect ? '#1a5a30' : '#5a1a1a') : '#1e2860')
    grad.addColorStop(1, b.hit ? (b.isCorrect ? '#0a2a18' : '#2a0a0a') : '#0d1540')
    ctx.fillStyle   = grad
    ctx.strokeStyle = b.hit ? (b.isCorrect ? '#00cc55' : '#cc2233') : '#3a4a9a'
    ctx.lineWidth   = 2
    ctx.beginPath(); ctx.arc(b.x, b.y, BUBBLE_R, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()

    // Text
    const isZh    = /[一-鿿]/.test(b.text)
    const fontSize = isZh && b.text.length <= 2 ? 26 : isZh ? 20 : b.text.length > 10 ? 14 : 17
    ctx.font      = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = b.hit ? (b.isCorrect ? '#00ff88' : '#ff5566') : '#ccdaff'
    ctx.textAlign = 'center'
    // Wrap long text
    if (b.text.length > 12 && !isZh) {
      const mid = Math.ceil(b.text.length / 2)
      const sp  = b.text.lastIndexOf(' ', mid) > 0 ? b.text.lastIndexOf(' ', mid) : mid
      ctx.fillText(b.text.slice(0, sp),  b.x, b.y - 7)
      ctx.fillText(b.text.slice(sp + 1), b.x, b.y + 13)
    } else {
      ctx.fillText(b.text, b.x, b.y + 6)
    }

    ctx.globalAlpha = 1
  }
}

function drawBullets() {
  ctx.fillStyle = '#aaff88'
  for (const bl of bullets) {
    ctx.beginPath()
    ctx.ellipse(bl.x, bl.y, 3, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawShip(x) {
  const y = SHIP_Y
  // Glow
  const g = ctx.createRadialGradient(x, y, 0, x, y, 36)
  g.addColorStop(0, 'rgba(80,100,255,0.3)')
  g.addColorStop(1, 'rgba(80,100,255,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, 36, 0, Math.PI * 2); ctx.fill()

  // Body
  ctx.fillStyle = targetBubble ? '#7799ff' : '#5577ff'
  ctx.beginPath()
  ctx.moveTo(x,      y - 26)
  ctx.lineTo(x - 16, y + 14)
  ctx.lineTo(x + 16, y + 14)
  ctx.closePath()
  ctx.fill()

  // Flame
  ctx.fillStyle = targetBubble ? '#ffaa00' : '#ff7722'
  const flicker = Math.sin(time * 0.018) * 6
  ctx.beginPath()
  ctx.moveTo(x - 8, y + 14)
  ctx.lineTo(x + 8, y + 14)
  ctx.lineTo(x, y + 28 + flicker)
  ctx.closePath()
  ctx.fill()

  // Aim line (faint, toward target)
  if (targetBubble && !targetBubble.hit) {
    ctx.strokeStyle = 'rgba(150,170,255,0.2)'
    ctx.lineWidth   = 1
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(x, y - 26)
    ctx.lineTo(targetBubble.x, targetBubble.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawHUD() {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 22px sans-serif'
  ctx.fillText(score, 14, H - 14)

  if (streak >= 2) {
    const mult = streak >= 4 ? 6 : streak >= 3 ? 4 : 2
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffd700'
    ctx.font      = 'bold 17px sans-serif'
    ctx.fillText(`×${mult} STREAK`, W - 14, H - 14)
  }

  // Progress dots
  const r = 5, dotY = H - 44, sp = r * 2 + 5
  const ox = W / 2 - (run.length * sp - 5) / 2 + r
  for (let i = 0; i < run.length; i++) {
    ctx.fillStyle = i < runIdx ? '#5577ff' : '#222244'
    ctx.beginPath(); ctx.arc(ox + i * sp, dotY, r, 0, Math.PI * 2); ctx.fill()
  }
}

function drawFlash() {
  if (flashAlpha <= 0) return
  ctx.fillStyle   = flashColor
  ctx.globalAlpha = flashAlpha
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1
}

// ── Screens ───────────────────────────────────────────────────────────────────
function drawStart() {
  drawBg()
  ctx.textAlign = 'center'

  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 38px sans-serif'
  ctx.fillText('汉字 Shooter', W / 2, H / 2 - 110)

  ctx.font      = '17px sans-serif'
  ctx.fillStyle = '#8899cc'
  ctx.fillText('Hold a bubble to aim and shoot', W / 2, H / 2 - 62)
  ctx.fillText('Hit the right answer for a multiplier', W / 2, H / 2 - 36)

  ctx.font      = '13px sans-serif'
  ctx.fillStyle = '#445566'
  ctx.fillText('HSK 3  •  10 questions  •  3 answer types', W / 2, H / 2 - 6)

  ctx.fillStyle = '#3344cc'
  roundRect(W / 2 - 90, H / 2 + 28, 180, 54, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 22px sans-serif'
  ctx.fillText('START', W / 2, H / 2 + 61)

  ctx.fillStyle = '#334455'
  ctx.font      = '13px sans-serif'
  ctx.fillText('tap and hold any bubble to shoot', W / 2, H - 24)
}

function drawDone() {
  drawBg()
  ctx.textAlign = 'center'

  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 32px sans-serif'
  ctx.fillText('完成了！', W / 2, H * 0.22)

  ctx.font      = '18px sans-serif'
  ctx.fillStyle = '#8899cc'
  ctx.fillText('Final Score', W / 2, H * 0.36)

  ctx.font      = 'bold 70px sans-serif'
  ctx.fillStyle = '#ffd700'
  ctx.fillText(score, W / 2, H * 0.50)

  // Perfect streak of 10 → 100+200+400+600×7 = 5500
  const maxScore = 100 + 200 + 400 + 600 * 7
  const pct      = Math.min(100, Math.round(score / maxScore * 100))
  ctx.font      = '15px sans-serif'
  ctx.fillStyle = '#445566'
  ctx.fillText(`${pct}% of max possible`, W / 2, H * 0.57)

  ctx.fillStyle = '#3344cc'
  roundRect(W / 2 - 90, H * 0.65, 180, 54, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 20px sans-serif'
  ctx.fillText('PLAY AGAIN', W / 2, H * 0.65 + 33)
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min(ts - lastTs, 50)
  lastTs = ts
  update(dt)

  if (phase === 'start') {
    drawStart()
  } else if (phase === 'done') {
    drawDone()
  } else {
    drawBg()
    if (run[runIdx - 1]) drawQuestion(run[runIdx - 1])
    drawBubbles()
    drawBullets()
    drawFlash()
    drawShip(shipX)
    drawHUD()
  }

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
