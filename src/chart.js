const POINTS = 60;

export function drawChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (!data.length) return;

    const max = Math.max(...data, 0.1);
    const step = w / (POINTS - 1);
    const pad = 6;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,122,0,0.15)');
    grad.addColorStop(1, 'rgba(255,122,0,0)');

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
        const x = i * step;
        const y = h - (data[i] / max) * (h - pad * 2) - pad;
        if (i === 0) ctx.lineTo(x, y);
        else {
            const px = (i - 1) * step;
            const py = h - (data[i - 1] / max) * (h - pad * 2) - pad;
            ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
        }
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const x = i * step;
        const y = h - (data[i] / max) * (h - pad * 2) - pad;
        if (i === 0) ctx.moveTo(x, y);
        else {
            const px = (i - 1) * step;
            const py = h - (data[i - 1] / max) * (h - pad * 2) - pad;
            ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
        }
    }
    ctx.strokeStyle = '#ff7a00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (data.length > 0) {
        const lx = (data.length - 1) * step;
        const ly = h - (data[data.length - 1] / max) * (h - pad * 2) - pad;
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff7a00';
        ctx.fill();
    }
}
