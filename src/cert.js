// Sertifikatni rasm (PNG) sifatida chizish va saqlash.
import iconUrl from '../public/icon.png?url';

function loadImg(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

export async function drawCertificate(c, t) {
  const W = 1600, H = 1130;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const head = '"Nunito","Segoe UI",Roboto,sans-serif';
  const body = 'system-ui,"Segoe UI",Roboto,sans-serif';
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#0F7A64'; x.lineWidth = 18; x.strokeRect(30, 30, W - 60, H - 60);
  x.strokeStyle = '#A9D8CB'; x.lineWidth = 3; x.strokeRect(70, 70, W - 140, H - 140);
  x.fillStyle = '#F2C94C'; x.fillRect(70, 70, W - 140, 10);

  const logo = await loadImg(iconUrl);
  if (logo) x.drawImage(logo, W / 2 - 165, 130, 90, 90);
  x.fillStyle = '#1B2A41'; x.font = `800 54px ${head}`; x.textAlign = 'left';
  x.fillText('Darsligim', W / 2 - 55, 195);

  x.textAlign = 'center';
  x.fillStyle = '#0B5E4D'; x.font = `700 40px ${body}`;
  x.fillText(t.certificate, W / 2, 310);
  x.fillStyle = '#5B6B79'; x.font = `400 32px ${body}`;
  x.fillText(t.certGiven, W / 2, 400);
  x.fillStyle = '#1B2A41'; x.font = `800 76px ${head}`;
  x.fillText(c.name, W / 2, 510);
  x.strokeStyle = '#C9D3CF'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(W / 2 - 420, 545); x.lineTo(W / 2 + 420, 545); x.stroke();
  x.fillStyle = '#1B2A41'; x.font = `400 34px ${body}`;
  wrap(x, t.certFor(c.title, c.pct), W / 2, 625, 1150, 50);

  x.fillStyle = '#5B6B79'; x.font = `400 26px ${body}`;
  x.textAlign = 'left'; x.fillText(t.date, 160, 900);
  x.textAlign = 'right'; x.fillText(t.number, W - 160, 900);
  x.fillStyle = '#1B2A41'; x.font = `700 32px ${body}`;
  x.textAlign = 'left'; x.fillText(c.date, 160, 945);
  x.textAlign = 'right'; x.fillText(c.id, W - 160, 945);
  x.textAlign = 'center'; x.fillStyle = '#0F7A64'; x.font = `700 30px ${body}`;
  x.fillText(`${c.score} / ${c.total}`, W / 2, 945);
  return cv.toDataURL('image/png');
}

// Rasmni saqlash: Android'da ulashish oynasi orqali, kompyuterda yuklab olish orqali.
export async function saveImage(dataUrl, filename) {
  const cap = window.Capacitor;
  const P = cap && cap.Plugins;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && P && P.Filesystem && P.Share) {
    const res = await P.Filesystem.writeFile({ path: filename, data: dataUrl.split(',')[1], directory: 'CACHE' });
    await P.Share.share({ title: filename, url: res.uri });
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
