const express = require('express');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Certificate fields catalogue
// ─────────────────────────────────────────────────────────────
const FIELDS = {
  'Web Development': {
    icon: '🌐',
    color: [41, 128, 185],
    accent: [52, 152, 219],
    tracks: {
      'Frontend Development':   { skills: ['HTML5', 'CSS3', 'JavaScript', 'React', 'Responsive Design'] },
      'Backend Development':    { skills: ['Node.js', 'Express', 'REST APIs', 'MongoDB', 'Authentication'] },
      'Full Stack Development': { skills: ['React', 'Node.js', 'MongoDB', 'REST APIs', 'Deployment'] },
      'UI/UX Design':           { skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems'] },
    },
  },
  'Data Science & AI': {
    icon: '🤖',
    color: [142, 68, 173],
    accent: [155, 89, 182],
    tracks: {
      'Machine Learning':        { skills: ['Python', 'Scikit-Learn', 'TensorFlow', 'Model Evaluation', 'Feature Engineering'] },
      'Deep Learning':           { skills: ['Neural Networks', 'CNN', 'RNN', 'PyTorch', 'Transfer Learning'] },
      'Data Analysis':           { skills: ['Python', 'Pandas', 'NumPy', 'Matplotlib', 'Statistical Analysis'] },
      'Natural Language Processing': { skills: ['NLP', 'Transformers', 'BERT', 'Text Classification', 'Named Entity Recognition'] },
      'Computer Vision':         { skills: ['OpenCV', 'Image Processing', 'Object Detection', 'CNN', 'YOLO'] },
    },
  },
  'Cloud & DevOps': {
    icon: '☁️',
    color: [39, 174, 96],
    accent: [46, 213, 115],
    tracks: {
      'AWS Cloud Practitioner':  { skills: ['EC2', 'S3', 'Lambda', 'RDS', 'CloudFormation'] },
      'DevOps Engineering':      { skills: ['Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Monitoring'] },
      'Site Reliability Engineering': { skills: ['SLOs', 'Incident Management', 'Automation', 'Monitoring', 'Capacity Planning'] },
      'Google Cloud Platform':   { skills: ['GKE', 'BigQuery', 'Cloud Run', 'Pub/Sub', 'Vertex AI'] },
    },
  },
  'Mobile Development': {
    icon: '📱',
    color: [231, 76, 60],
    accent: [255, 107, 107],
    tracks: {
      'React Native':            { skills: ['React Native', 'Expo', 'Navigation', 'State Management', 'Native APIs'] },
      'Flutter Development':     { skills: ['Dart', 'Flutter', 'Widgets', 'State Management', 'Firebase'] },
      'iOS Development':         { skills: ['Swift', 'SwiftUI', 'UIKit', 'Core Data', 'App Store Connect'] },
      'Android Development':     { skills: ['Kotlin', 'Jetpack Compose', 'Android SDK', 'Room', 'MVVM'] },
    },
  },
  'Cybersecurity': {
    icon: '🔐',
    color: [44, 62, 80],
    accent: [52, 73, 94],
    tracks: {
      'Ethical Hacking':         { skills: ['Penetration Testing', 'Kali Linux', 'Network Security', 'OWASP', 'Vulnerability Assessment'] },
      'Network Security':        { skills: ['Firewalls', 'IDS/IPS', 'VPN', 'Network Protocols', 'Threat Analysis'] },
      'Application Security':    { skills: ['SAST', 'DAST', 'Secure Coding', 'OAuth', 'Cryptography'] },
      'SOC Analysis':            { skills: ['SIEM', 'Log Analysis', 'Incident Response', 'Threat Intelligence', 'Digital Forensics'] },
    },
  },
  'Data Engineering': {
    icon: '🔧',
    color: [243, 156, 18],
    accent: [241, 196, 15],
    tracks: {
      'Big Data Engineering':    { skills: ['Apache Spark', 'Hadoop', 'Kafka', 'Data Lakes', 'ETL Pipelines'] },
      'Database Administration': { skills: ['PostgreSQL', 'MySQL', 'MongoDB', 'Query Optimization', 'Replication'] },
      'Data Warehousing':        { skills: ['Snowflake', 'Redshift', 'dbt', 'Data Modeling', 'Star Schema'] },
      'Stream Processing':       { skills: ['Apache Flink', 'Kafka Streams', 'Real-time Analytics', 'Event Sourcing', 'CQRS'] },
    },
  },
  'Product Management': {
    icon: '📊',
    color: [22, 160, 133],
    accent: [26, 188, 156],
    tracks: {
      'Product Strategy':        { skills: ['Product Roadmap', 'OKRs', 'Market Research', 'Competitive Analysis', 'Go-to-Market'] },
      'Agile & Scrum':           { skills: ['Scrum', 'Kanban', 'Sprint Planning', 'Backlog Grooming', 'Stakeholder Management'] },
      'Growth Product':          { skills: ['A/B Testing', 'Funnel Analysis', 'Retention', 'Metrics', 'Experimentation'] },
    },
  },
  'Blockchain': {
    icon: '⛓️',
    color: [52, 73, 94],
    accent: [100, 181, 246],
    tracks: {
      'Smart Contract Development': { skills: ['Solidity', 'Ethereum', 'Hardhat', 'Web3.js', 'DeFi Protocols'] },
      'Web3 Development':        { skills: ['React', 'ethers.js', 'IPFS', 'NFTs', 'Wallet Integration'] },
      'Blockchain Architecture': { skills: ['Consensus Mechanisms', 'Layer 2', 'Cross-chain', 'Tokenomics', 'DAO Governance'] },
    },
  },
};

const DURATION_LABELS = {
  1: '1 Month Intensive Program',
  2: '2 Month Professional Program',
  3: '3 Month Comprehensive Program',
  6: '6 Month Expert Program',
  12: '1 Year Mastery Program',
};

// ─────────────────────────────────────────────────────────────
// GET /api/certificate/fields — all fields and tracks
// ─────────────────────────────────────────────────────────────
router.get('/fields', (req, res) => {
  const result = Object.entries(FIELDS).map(([field, data]) => ({
    field,
    icon: data.icon,
    color: data.color,
    tracks: Object.keys(data.tracks),
  }));
  res.json({ fields: result });
});

// ─────────────────────────────────────────────────────────────
// GET /api/certificate/tracks/:field — tracks for a field
// ─────────────────────────────────────────────────────────────
router.get('/tracks/:field', (req, res) => {
  const fieldData = FIELDS[req.params.field];
  if (!fieldData) return res.status(404).json({ error: 'Field not found.' });
  res.json({ tracks: fieldData.tracks });
});

// ─────────────────────────────────────────────────────────────
// POST /api/certificate/generate — generate PDF certificate
// ─────────────────────────────────────────────────────────────
router.post('/generate', protect, async (req, res, next) => {
  try {
    const { field, track, duration, recipientName } = req.body;
    if (!field || !track || !duration) {
      return res.status(400).json({ error: 'Field, track, and duration are required.' });
    }

    const fieldData = FIELDS[field];
    if (!fieldData) return res.status(400).json({ error: 'Invalid field.' });
    const trackData = fieldData.tracks[track];
    if (!trackData) return res.status(400).json({ error: 'Invalid track.' });

    const user = await User.findById(req.user._id);
    const name = recipientName || user.name || 'Learner';
    const certId = uuidv4().substring(0, 12).toUpperCase();
    const issueDate = new Date();
    const durationNum = Number(duration);

    const completionDate = new Date(issueDate);
    completionDate.setMonth(completionDate.getMonth() + durationNum);

    const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify/${certId}`;

    // Generate QR code buffer
    const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 80, margin: 1, color: { dark: '#1a1a2e', light: '#ffffff' } });

    // ── Build PDF ──────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certId}.pdf"`);
    doc.pipe(res);

    const W = 842, H = 595;
    const [r, g, b] = fieldData.color;
    const [ar, ag, ab] = fieldData.accent;

    // Background
    doc.rect(0, 0, W, H).fill('#fafafa');

    // Left color bar
    doc.rect(0, 0, 18, H).fill([r, g, b]);

    // Right color bar
    doc.rect(W - 18, 0, 18, H).fill([r, g, b]);

    // Top border stripe
    doc.rect(18, 0, W - 36, 8).fill([ar, ag, ab]);

    // Bottom border stripe
    doc.rect(18, H - 8, W - 36, 8).fill([ar, ag, ab]);

    // Decorative corner circles
    [[38, 28], [W - 38, 28], [38, H - 28], [W - 38, H - 28]].forEach(([cx, cy]) => {
      doc.circle(cx, cy, 14).fill([r, g, b]);
      doc.circle(cx, cy, 9).fill([ar, ag, ab]);
    });

    // Watermark (very faint)
    doc.save()
      .fillColor([r, g, b]).opacity(0.04)
      .fontSize(160).font('Helvetica-Bold')
      .text('CERTIFIED', 80, H / 2 - 80, { width: W - 160, align: 'center' })
      .restore();

    // ── Header ────────────────────────────────────────────
    doc.fillColor([r, g, b]).fontSize(11).font('Helvetica').text('RESUMEFLOW ACADEMY', 40, 30, { align: 'center', width: W - 80, characterSpacing: 4 });

    doc.fillColor([r, g, b]).fontSize(38).font('Helvetica-Bold').text('Certificate of Completion', 40, 52, { align: 'center', width: W - 80 });

    doc.moveTo(W / 2 - 120, 105).lineTo(W / 2 + 120, 105).lineWidth(1).strokeColor([ar, ag, ab]).stroke();

    // ── Body ─────────────────────────────────────────────
    doc.fillColor('#555555').fontSize(13).font('Helvetica').text('This is to certify that', 40, 125, { align: 'center', width: W - 80 });

    // Name
    doc.fillColor('#1a1a2e').fontSize(42).font('Helvetica-Bold').text(name, 40, 148, { align: 'center', width: W - 80 });

    doc.moveTo(W / 2 - 160, 205).lineTo(W / 2 + 160, 205).lineWidth(0.5).strokeColor('#cccccc').stroke();

    doc.fillColor('#555555').fontSize(13).font('Helvetica')
      .text('has successfully completed the', 40, 215, { align: 'center', width: W - 80 });

    // Track name
    doc.fillColor([r, g, b]).fontSize(24).font('Helvetica-Bold')
      .text(track, 40, 235, { align: 'center', width: W - 80 });

    doc.fillColor('#444444').fontSize(13).font('Helvetica')
      .text(`${DURATION_LABELS[durationNum] || `${durationNum} Month Program`} in ${field}`, 40, 270, { align: 'center', width: W - 80 });

    // Skills pills row
    const skills = trackData.skills;
    const pillW = 105, pillH = 22, pillGap = 8;
    const totalPillsW = skills.length * pillW + (skills.length - 1) * pillGap;
    let pillX = (W - totalPillsW) / 2;
    const pillY = 302;

    skills.forEach(skill => {
      doc.roundedRect(pillX, pillY, pillW, pillH, 11).fill([r, g, b]);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text(skill, pillX, pillY + 7, { width: pillW, align: 'center' });
      pillX += pillW + pillGap;
    });

    // ── Footer section ─────────────────────────────────────
    const footerY = 345;

    // Divider
    doc.moveTo(60, footerY).lineTo(W - 60, footerY).lineWidth(0.5).strokeColor('#dddddd').stroke();

    // Dates
    const dateOpts = { day: 'numeric', month: 'long', year: 'numeric' };
    doc.fillColor('#777777').fontSize(10).font('Helvetica')
      .text('Program Start', 80, footerY + 18)
      .text(issueDate.toLocaleDateString('en-US', dateOpts), 80, footerY + 33)
      .fillColor('#333333').font('Helvetica-Bold');

    doc.fillColor('#777777').fontSize(10).font('Helvetica')
      .text('Program End', W / 2 - 60, footerY + 18)
      .text(completionDate.toLocaleDateString('en-US', dateOpts), W / 2 - 60, footerY + 33);

    // Certificate ID
    doc.fillColor('#777777').fontSize(10).font('Helvetica')
      .text('Certificate ID', W - 200, footerY + 18)
      .fillColor([r, g, b]).font('Helvetica-Bold').fontSize(11)
      .text(certId, W - 200, footerY + 33);

    // Signature line (left)
    const sigY = footerY + 80;
    doc.moveTo(80, sigY).lineTo(240, sigY).lineWidth(1).strokeColor('#333333').stroke();
    doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold').text('Authorized Signatory', 80, sigY + 6);
    doc.fillColor('#777777').fontSize(9).font('Helvetica').text('ResumeFlow Academy', 80, sigY + 20);

    // Field icon circle (center)
    doc.circle(W / 2, sigY - 12, 28).fill([r, g, b]);
    doc.fillColor('white').fontSize(26).text(fieldData.icon, W / 2 - 15, sigY - 27);

    // Signature line (right)
    doc.moveTo(W - 240, sigY).lineTo(W - 80, sigY).lineWidth(1).strokeColor('#333333').stroke();
    doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold').text('Program Director', W - 240, sigY + 6);
    doc.fillColor('#777777').fontSize(9).font('Helvetica').text('ResumeFlow Academy', W - 240, sigY + 20);

    // QR code
    doc.image(qrBuffer, W - 115, footerY + 10, { width: 65 });
    doc.fillColor('#999999').fontSize(7).font('Helvetica').text('Scan to verify', W - 113, footerY + 78);

    // ── Seal ──────────────────────────────────────────────
    const sealX = W / 2, sealY = H - 55;
    doc.circle(sealX, sealY, 32).fill([r, g, b]);
    doc.circle(sealX, sealY, 27).fill([ar, ag, ab]);
    doc.circle(sealX, sealY, 22).fill([r, g, b]);
    doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
      .text('VERIFIED', sealX - 14, sealY - 5, { width: 28, align: 'center' })
      .text('CERTIFIED', sealX - 16, sealY + 2, { width: 32, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Certificate error:', err);
    if (!res.headersSent) next(err);
  }
});

module.exports = router;