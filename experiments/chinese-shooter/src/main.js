import { DECK } from './cards.js'

const W = 390, H = 680
const PLAYER_Y = H - 85
const GATE_H = 92
const GATE_SPEED = 3.2   // px per 16ms frame
const PAD = 8

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H)
  canvas.style.width  = `${W * s}px`
  canvas.style.height = `${H * s}px`
}
window.addEventListener('resize', resize)
resize()

// ── State ────────────────────────────────────────────────────────────────────

let phase     = 'start'  // 'start' | 'playing' | 'paused' | 'done'
let cardIndex = 0
let gate      = null     // { card, leftText, rightText, correctSide }
let gateY     = 0
let scored    = false
let playerX   = W / 4   // smoothly interpolated current x
let targetX   = W / 4   // left lane centre
let score     = 0
let streak    = 0
let flashColor = ''
let flashAlpha = 0
let feedback  = null     // { text, color } shown in question box after scoring
let time      = 0

// ── Helpers ──────────────────────────────────────────────────────────────────

function shuffleGate(card) {
  const leftCorrect = Math.random() < 0.5
  return {
    card,
    leftText:    leftCorrect ? card.correct : card.wrong,
    rightText:   leftCorrect ? card.wrong   : card.correct,
    correctSide: leftCorrect ? 'left'       : 'right',
  }
}

function multiplierFor(s) { return s >= 3 ? 4 : s >= 2 ? 2 : 1 }

function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,   x + w, y + r,   r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,   y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x,   y,   x + r, y,       r)
  ctx.closePath()
}

// ── Game logic ────────────────────────────────────────────────────────────────

function startGame() {
  phase     = 'playing'
  cardIndex = 0
  score     = 0
  streak    = 0
  feedback  = null
  targetX   = W / 4
  spawnGate()
}

function spawnGate() {
  if (cardIndex >= DECK.length) { phase = 'done'; return }
  gate     = shuffleGate(DECK[cardIndex++])
  gateY    = -130
  scored   = false
  feedback = null
  phase    = 'playing'
}

function steer(xOnCanvas) {
  if (phase === 'start') { startGame(); return }
  if (phase === 'done')  return
  targetX = xOnCanvas < W / 2 ? W / 4 : W * 3 / 4
}

// ── Input ─────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (phase === 'start') { startGame(); return }
  if (e.key === 'ArrowLeft')  steer(0)
  if (e.key === 'ArrowRight') steer(W)
})

function clientToCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect()
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top)  * (H / r.height),
  }
}

canvas.addEventListener('click', e => {
  const { x, y } = clientToCanvas(e.clientX, e.clientY)
  if (phase === 'done') {
    // "Play again" button: centred at H*0.65 + 27
    if (Math.abs(x - W / 2) < 90 && y > H * 0.65 && y < H * 0.65 + 54) startGame()
    return
  }
  steer(x)
})

canvas.addEventListener('touchstart', e => {
  e.preventDefault()
  steer(clientToCanvas(e.touches[0].clientX, e.touches[0].clientY).x)
}, { passive: false })

// ── Update ────────────────────────────────────────────────────────────────────

function update(dt) {
  time      += dt
  playerX   += (targetX - playerX) * 0.18 * (dt / 16)
  flashAlpha = Math.max(0, flashAlpha - 0.02 * (dt / 16))

  if (phase !== 'playing' && phase !== 'paused') return

  gateY += GATE_SPEED * (dt / 16)

  if (!scored && gateY + GATE_H / 2 >= PLAYER_Y) {
    scored = true
    const side    = playerX < W / 2 ? 'left' : 'right'
    const correct = side === gate.correctSide

    if (correct) {
      streak++
      const mult = multiplierFor(streak)
      score += 100 * mult
      flashColor  = '#00e676'
      flashAlpha  = 0.35
      feedback    = { text: streak >= 2 ? `Correct!  ×${mult} streak` : 'Correct!', color: '#00ff88' }
    } else {
      streak     = 0
      flashColor = '#ff1744'
      flashAlpha = 0.35
      feedback   = { text: 'Wrong!', color: '#ff5566' }
    }
    phase = 'paused'
    setTimeout(spawnGate, 950)
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────

function drawBg() {
  ctx.fillStyle = '#0d0d1a'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = '#151525'
  ctx.lineWidth   = 1
  const sp = 35
  for (let i = 0; i <= H / sp + 1; i++) {
    const y = ((time * 0.08 + i * sp) % H)
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  ctx.strokeStyle = '#252545'
  ctx.lineWidth   = 2
  ctx.setLineDash([14, 10])
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.setLineDash([])
}

function drawQuestion() {
  if (!gate) return
  const card = gate.card

  ctx.fillStyle   = '#10102a'
  roundRect(10, 10, W - 20, 118, 12)
  ctx.fill()
  ctx.strokeStyle = '#2a2a5a'
  ctx.lineWidth   = 1.5
  ctx.stroke()

  ctx.textAlign = 'center'

  if (phase === 'paused' && feedback) {
    ctx.font      = 'bold 24px sans-serif'
    ctx.fillStyle = feedback.color
    ctx.fillText(feedback.text, W / 2, 72)
    return
  }

  if (card.type === 'vocab') {
    ctx.font      = 'bold 50px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(card.zh, W / 2, 72)
    ctx.font      = '17px sans-serif'
    ctx.fillStyle = '#7788cc'
    ctx.fillText(card.py, W / 2, 97)
    ctx.font      = '13px sans-serif'
    ctx.fillStyle = '#445566'
    ctx.fillText('What does it mean?', W / 2, 118)
  } else {
    ctx.font      = 'bold 25px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(card.sentence, W / 2, 65)
    ctx.font      = '15px sans-serif'
    ctx.fillStyle = '#7788cc'
    ctx.fillText(card.hint, W / 2, 92)
    ctx.font      = '13px sans-serif'
    ctx.fillStyle = '#445566'
    ctx.fillText('Fill in the blank', W / 2, 115)
  }
}

function drawGates() {
  if (!gate) return
  const gw = W / 2 - PAD * 1.5

  for (let i = 0; i < 2; i++) {
    const gx   = i === 0 ? PAD : W / 2 + PAD / 2
    const side = i === 0 ? 'left' : 'right'
    const text = i === 0 ? gate.leftText : gate.rightText

    let fill   = '#1a2860'
    let stroke = '#2d3f8a'
    let textC  = '#ccdaff'

    if (scored) {
      const isCorrect = side === gate.correctSide
      fill   = isCorrect ? '#0d4a2a' : '#4a0d1a'
      stroke = isCorrect ? '#00cc55' : '#cc0033'
      textC  = isCorrect ? '#00ff88' : '#ff5566'
    }

    ctx.fillStyle   = fill
    roundRect(gx, gateY, gw, GATE_H, 10)
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth   = 2
    ctx.stroke()

    ctx.fillStyle = textC
    ctx.textAlign = 'center'
    ctx.font      = `bold ${gate.card.type === 'fill' ? '28px' : '19px'} sans-serif`
    ctx.fillText(text, gx + gw / 2, gateY + GATE_H / 2 + 8)
  }
}

function drawShip(x, y) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, 32)
  g.addColorStop(0, 'rgba(80,100,255,0.35)')
  g.addColorStop(1, 'rgba(80,100,255,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = '#5577ff'
  ctx.beginPath()
  ctx.moveTo(x, y - 24)
  ctx.lineTo(x - 15, y + 14)
  ctx.lineTo(x + 15, y + 14)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ff7722'
  const flicker = Math.sin(time * 0.015) * 5
  ctx.beginPath()
  ctx.moveTo(x - 7, y + 14)
  ctx.lineTo(x + 7, y + 14)
  ctx.lineTo(x, y + 26 + flicker)
  ctx.closePath()
  ctx.fill()
}

function drawHUD() {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 22px sans-serif'
  ctx.fillText(score, 14, H - 14)

  if (streak >= 2) {
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffd700'
    ctx.font      = 'bold 17px sans-serif'
    ctx.fillText(`×${multiplierFor(streak)} STREAK`, W - 14, H - 14)
  }

  // Progress dots
  const r  = 5, dotY = H - 44
  const sp = r * 2 + 5
  const ox = W / 2 - (DECK.length * sp - 5) / 2 + r
  for (let i = 0; i < DECK.length; i++) {
    ctx.fillStyle = i < cardIndex ? '#5577ff' : '#222244'
    ctx.beginPath(); ctx.arc(ox + i * sp, dotY, r, 0, Math.PI * 2); ctx.fill()
  }
}

function drawFlash() {
  if (flashAlpha <= 0) return
  ctx.fillStyle  = flashColor
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
  ctx.fillText('汉字 Shooter', W / 2, H / 2 - 100)

  ctx.font      = '17px sans-serif'
  ctx.fillStyle = '#8899cc'
  ctx.fillText('Steer into the correct answer', W / 2, H / 2 - 55)
  ctx.fillText('Streaks multiply your score!', W / 2, H / 2 - 28)

  ctx.font      = '13px sans-serif'
  ctx.fillStyle = '#445566'
  ctx.fillText('HSK 3  •  6 questions', W / 2, H / 2 + 2)

  ctx.fillStyle = '#3344cc'
  roundRect(W / 2 - 90, H / 2 + 32, 180, 54, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 22px sans-serif'
  ctx.fillText('START', W / 2, H / 2 + 65)

  ctx.fillStyle = '#334455'
  ctx.font      = '13px sans-serif'
  ctx.fillText('← → keys  or  tap left / right', W / 2, H - 24)
}

function drawDone() {
  drawBg()
  ctx.textAlign = 'center'

  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 32px sans-serif'
  ctx.fillText('完成了！', W / 2, H * 0.25)

  ctx.font      = '18px sans-serif'
  ctx.fillStyle = '#8899cc'
  ctx.fillText('Final Score', W / 2, H * 0.38)

  ctx.font      = 'bold 70px sans-serif'
  ctx.fillStyle = '#ffd700'
  ctx.fillText(score, W / 2, H * 0.52)

  // Max possible: 100 + 200 + 400*(n-2)
  const maxScore = 100 + 200 + 400 * (DECK.length - 2)
  const pct      = Math.min(100, Math.round(score / maxScore * 100))
  ctx.font      = '15px sans-serif'
  ctx.fillStyle = '#445566'
  ctx.fillText(`${pct}% of max possible`, W / 2, H * 0.58)

  ctx.fillStyle = '#3344cc'
  roundRect(W / 2 - 90, H * 0.65, 180, 54, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 20px sans-serif'
  ctx.fillText('PLAY AGAIN', W / 2, H * 0.65 + 33)
}

// ── Loop ──────────────────────────────────────────────────────────────────────

let lastTs = 0
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
    drawQuestion()
    drawGates()
    drawFlash()
    drawShip(playerX, PLAYER_Y)
    drawHUD()
  }

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
