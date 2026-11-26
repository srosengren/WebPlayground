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
const BUBBLE_R     = 36
const BULLET_SPEED = 9
const SHIP_SPEED   = 5.5
const NUM_OPTIONS  = 3
const SPAWN_Y      = 160
const PASS_Y       = SHIP_Y

function bubbleSpeed() {
  return 0.7 + Math.min(questionsAnswered / 20, 1.0) * 0.8
}

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
  const distractors = pick(card.distractors, NUM_OPTIONS - 1)
  const opts = [card.correct, ...distractors]
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]]
  }
  return opts
}

function buildDeck() {
  const copy = [...DECK]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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
let phase             = 'start'
let deck              = []
let deckIdx           = 0
let currentCard       = null
let bubbles           = []
let bullets           = []
let shipX             = W / 2
let pressX            = null       // current x of held press; null = not pressing
let targetBubble      = null       // bubble nearest to pressX (visual only)
let score             = 0
let streak            = 0
let lives             = 3
let questionsAnswered = 0
let resolving         = false
let pendingNextCard   = false
let flashColor        = ''
let flashAlpha        = 0
let feedback          = null
let feedTimer         = 0
let time              = 0

// ── Bubble spawning ───────────────────────────────────────────────────────────
function spawnBubbles(card) {
  const opts = shuffleOptions(card)
  bubbles = opts.map((text, i) => ({
    x: (W / (NUM_OPTIONS + 1)) * (i + 1),
    y: SPAWN_Y,
    text,
    isCorrect: text === card.correct,
    hit:       false,
    hitTimer:  0,
    passed:    false,
  }))
}

function nextCard() {
  if (deckIdx >= deck.length) {
    deck    = buildDeck()
    deckIdx = 0
  }
  currentCard = deck[deckIdx++]
  bullets     = []
  resolving   = false
  // feedback/feedTimer intentionally NOT cleared — carry over briefly
  spawnBubbles(currentCard)
  phase = 'playing'
}

function startGame() {
  deck              = buildDeck()
  deckIdx           = 0
  score             = 0
  streak            = 0
  lives             = 3
  questionsAnswered = 0
  resolving         = false
  pendingNextCard   = false
  feedback          = null
  feedTimer         = 0
  shipX             = W / 2
  nextCard()
}

// ── Input ─────────────────────────────────────────────────────────────────────
function getCanvasPos(clientX, clientY) {
  const r = canvas.getBoundingClientRect()
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top)  * (H / r.height),
  }
}

function onPress(x, y) {
  if (phase === 'start') { startGame(); return }
  if (phase === 'done') {
    if (Math.abs(x - W / 2) < 90 && y > H * 0.65 && y < H * 0.65 + 54) startGame()
    return
  }
  if (phase !== 'playing') return
  pressX = x
}

function onMove(x) {
  if (pressX === null || phase !== 'playing') return
  pressX = x
}

function onRelease() { pressX = null }

canvas.addEventListener('mousedown',  e => { const p = getCanvasPos(e.clientX, e.clientY); onPress(p.x, p.y) })
canvas.addEventListener('mousemove',  e => { if (e.buttons) { const p = getCanvasPos(e.clientX, e.clientY); onMove(p.x) } })
canvas.addEventListener('mouseup',    onRelease)
canvas.addEventListener('mouseleave', onRelease)

canvas.addEventListener('touchstart', e => {
  e.preventDefault()
  const p = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY)
  onPress(p.x, p.y)
}, { passive: false })
canvas.addEventListener('touchmove', e => {
  e.preventDefault()
  const p = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY)
  onMove(p.x)
}, { passive: false })
canvas.addEventListener('touchend',    e => { e.preventDefault(); onRelease() }, { passive: false })
canvas.addEventListener('touchcancel', e => { e.preventDefault(); onRelease() }, { passive: false })

document.addEventListener('keydown', e => { if (phase === 'start') startGame() })

// ── Update ────────────────────────────────────────────────────────────────────
let lastTs = 0, bulletCooldown = 0

function update(dt) {
  time       += dt
  flashAlpha  = Math.max(0, flashAlpha - 0.025 * (dt / 16))
  if (feedTimer > 0) feedTimer -= dt
  if (phase !== 'playing') return

  // Ship moves toward pressX (anywhere on screen)
  if (pressX !== null) {
    const dx = pressX - shipX
    shipX += Math.sign(dx) * Math.min(Math.abs(dx), SHIP_SPEED * (dt / 16))
  }
  shipX = Math.max(24, Math.min(W - 24, shipX))

  // Nearest live bubble to pressX (for aim indicator and fire target)
  targetBubble = pressX !== null
    ? (bubbles.find(b => !b.hit && !b.passed && Math.abs(b.x - pressX) < BUBBLE_R + 15) ?? null)
    : null

  // Advance bubbles downward
  const spd = bubbleSpeed()
  for (const b of bubbles) {
    if (b.hit)    { b.hitTimer -= dt; continue }
    if (b.passed) continue
    b.y += spd * (dt / 16)
    if (b.y >= PASS_Y) {
      b.passed = true
      if (b.isCorrect && !resolving) {
        resolving   = true
        streak      = 0
        lives       = Math.max(0, lives - 1)
        flashColor  = '#ff4400'; flashAlpha = 0.4
        feedback    = { text: 'Missed!  −♥', color: '#ff7744' }
        feedTimer   = 1000
        questionsAnswered++
        if (lives <= 0) { phase = 'done'; return }
        setTimeout(nextCard, 800)
      }
    }
  }

  // Fire when ship has arrived at the pressed position
  const aligned = pressX !== null && Math.abs(shipX - pressX) < 30
  bulletCooldown -= dt
  if (aligned && targetBubble && !targetBubble.hit && !targetBubble.passed && bulletCooldown <= 0) {
    bullets.push({ x: shipX, y: SHIP_Y - 28 })
    bulletCooldown = 120
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bl = bullets[i]
    bl.y -= BULLET_SPEED * (dt / 16)
    if (bl.y < -20) { bullets.splice(i, 1); continue }
    let consumed = false
    for (const b of bubbles) {
      if (b.hit || b.passed) continue
      if (Math.hypot(bl.x - b.x, bl.y - b.y) < BUBBLE_R) {
        bullets.splice(i, 1)
        b.hit = true; b.hitTimer = 500
        scoreHit(b)
        consumed = true
        break
      }
    }
    if (consumed) continue
  }

  // Advance to next card immediately after correct hit (deferred out of bullet loop)
  if (pendingNextCard) {
    pendingNextCard = false
    questionsAnswered++
    if (lives <= 0) { phase = 'done'; return }
    nextCard()
  }
}

function scoreHit(b) {
  pressX = null   // require re-press after any hit so firing doesn't continue
  if (b.isCorrect) {
    streak++
    // Multiplier keeps growing: ×1, ×2, ×4, ×6, ×8, ×10 …
    const mult = streak <= 1 ? 1 : (streak - 1) * 2
    score += 100 * mult
    flashColor = '#00e676'; flashAlpha = 0.3
    feedback   = { text: streak >= 2 ? `Correct!  ×${mult}` : 'Correct!', color: '#00ff88' }
    feedTimer  = 800
    pendingNextCard = true      // resolved at end of update, outside bullet loop
  } else {
    streak    = 0
    score     = Math.max(0, score - 50)
    flashColor = '#ff1744'; flashAlpha = 0.3
    feedback   = { text: 'Wrong!  −50', color: '#ff5566' }
    feedTimer  = 900
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
  ctx.textAlign   = 'center'

  const p     = promptFor(card)
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

function drawFeedback() {
  if (!feedback || feedTimer <= 0) return
  ctx.globalAlpha = Math.min(feedTimer / 300, 1)
  ctx.textAlign   = 'center'
  ctx.font        = 'bold 20px sans-serif'
  ctx.fillStyle   = feedback.color
  ctx.fillText(feedback.text, W / 2, 148)
  ctx.globalAlpha = 1
}

function drawBubbles() {
  for (const b of bubbles) {
    if (b.passed) continue
    ctx.globalAlpha = b.hit ? Math.max(0, b.hitTimer / 500) : 1

    if (b === targetBubble && !b.hit) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth   = 2.5
      ctx.beginPath(); ctx.arc(b.x, b.y, BUBBLE_R + 6, 0, Math.PI * 2); ctx.stroke()
    }

    const grad = ctx.createRadialGradient(b.x - 10, b.y - 10, 4, b.x, b.y, BUBBLE_R)
    grad.addColorStop(0, b.hit ? (b.isCorrect ? '#1a5a30' : '#5a1a1a') : '#1e2860')
    grad.addColorStop(1, b.hit ? (b.isCorrect ? '#0a2a18' : '#2a0a0a') : '#0d1540')
    ctx.fillStyle   = grad
    ctx.strokeStyle = b.hit ? (b.isCorrect ? '#00cc55' : '#cc2233') : '#3a4a9a'
    ctx.lineWidth   = 2
    ctx.beginPath(); ctx.arc(b.x, b.y, BUBBLE_R, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()

    const isZh    = /[一-鿿]/.test(b.text)
    const fontSize = isZh && b.text.length <= 2 ? 20 : isZh ? 14 : b.text.length > 9 ? 11 : 14
    ctx.font      = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = b.hit ? (b.isCorrect ? '#00ff88' : '#ff5566') : '#ccdaff'
    ctx.textAlign = 'center'
    if (b.text.length > 9 && !isZh) {
      const mid = Math.ceil(b.text.length / 2)
      const sp  = b.text.lastIndexOf(' ', mid) > 0 ? b.text.lastIndexOf(' ', mid) : mid
      ctx.fillText(b.text.slice(0, sp),  b.x, b.y - 5)
      ctx.fillText(b.text.slice(sp + 1), b.x, b.y + 9)
    } else {
      ctx.fillText(b.text, b.x, b.y + 5)
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
  const y       = SHIP_Y
  const active  = pressX !== null
  const g = ctx.createRadialGradient(x, y, 0, x, y, 36)
  g.addColorStop(0, 'rgba(80,100,255,0.3)')
  g.addColorStop(1, 'rgba(80,100,255,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, 36, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = active ? '#7799ff' : '#5577ff'
  ctx.beginPath()
  ctx.moveTo(x,      y - 26)
  ctx.lineTo(x - 16, y + 14)
  ctx.lineTo(x + 16, y + 14)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = active ? '#ffaa00' : '#ff7722'
  const flicker = Math.sin(time * 0.018) * 6
  ctx.beginPath()
  ctx.moveTo(x - 8, y + 14)
  ctx.lineTo(x + 8, y + 14)
  ctx.lineTo(x, y + 28 + flicker)
  ctx.closePath()
  ctx.fill()

  if (targetBubble && !targetBubble.hit && !targetBubble.passed) {
    ctx.strokeStyle = 'rgba(150,170,255,0.2)'
    ctx.lineWidth   = 1
    ctx.setLineDash([6, 6])
    ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(targetBubble.x, targetBubble.y); ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawHUD() {
  // Row 1: hearts left, Q counter right
  ctx.font      = '20px sans-serif'
  ctx.textAlign = 'left'
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < lives ? '#ff4455' : '#222233'
    ctx.fillText('♥', 14 + i * 26, H - 40)
  }
  ctx.textAlign = 'right'
  ctx.fillStyle = '#445566'
  ctx.font      = '13px sans-serif'
  ctx.fillText(`Q ${questionsAnswered + 1}`, W - 14, H - 40)

  // Row 2: score left, streak right
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 22px sans-serif'
  ctx.fillText(score, 14, H - 14)

  if (streak >= 2) {
    const mult = (streak - 1) * 2
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffd700'
    ctx.font      = 'bold 17px sans-serif'
    ctx.fillText(`×${mult} STREAK`, W - 14, H - 14)
  }
}

function drawFlash() {
  if (flashAlpha <= 0) return
  ctx.fillStyle   = flashColor
  ctx.globalAlpha = flashAlpha
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1
}

function drawStart() {
  drawBg()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 38px sans-serif'
  ctx.fillText('汉字 Shooter', W / 2, H / 2 - 110)
  ctx.font      = '17px sans-serif'
  ctx.fillStyle = '#8899cc'
  ctx.fillText('Press anywhere to move your ship', W / 2, H / 2 - 62)
  ctx.fillText("Align under the right answer to shoot", W / 2, H / 2 - 36)
  ctx.font      = '13px sans-serif'
  ctx.fillStyle = '#445566'
  ctx.fillText('HSK 3  •  3 lives  •  3 answer types', W / 2, H / 2 - 6)
  ctx.fillStyle = '#3344cc'
  roundRect(W / 2 - 90, H / 2 + 28, 180, 54, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 22px sans-serif'
  ctx.fillText('START', W / 2, H / 2 + 61)
}

function drawDone() {
  drawBg()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 32px sans-serif'
  ctx.fillText('Game Over', W / 2, H * 0.22)
  ctx.font      = '18px sans-serif'
  ctx.fillStyle = '#8899cc'
  ctx.fillText(`${questionsAnswered} questions answered`, W / 2, H * 0.33)
  ctx.font      = '15px sans-serif'
  ctx.fillStyle = '#445566'
  ctx.fillText('Final Score', W / 2, H * 0.42)
  ctx.font      = 'bold 70px sans-serif'
  ctx.fillStyle = '#ffd700'
  ctx.fillText(score, W / 2, H * 0.55)
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
    if (currentCard) drawQuestion(currentCard)
    drawFeedback()
    drawBubbles()
    drawBullets()
    drawFlash()
    drawShip(shipX)
    drawHUD()
  }

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
