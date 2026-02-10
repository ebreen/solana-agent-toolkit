#!/usr/bin/env node
/**
 * Bounty Hunter Tracker
 * Tracks Superteam Earn bounties and other Solana earning opportunities
 * Helps manage submissions and deadlines
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOUNTY_DATA_FILE = path.join(__dirname, 'bounty-data.json');

// Default bounty database
const DEFAULT_BOUNTIES = {
  superteam: [
    {
      id: 'st-001',
      title: 'Solana Audit Subsidy Program - Cohort V',
      sponsor: 'Areta',
      platform: 'Superteam Earn',
      url: 'https://superteam.fun/earn/listing/solana-audit-subsidy-program-cohort-v-applications-by-february-7th/',
      category: 'Security/Audit',
      prizePool: 37500,
      currency: 'USDC',
      deadline: '2026-02-07',
      status: 'closing-today',
      skills: ['Security', 'Rust', 'Anchor'],
      description: 'Applications for audit subsidy program',
      submissionUrl: null,
      mySubmission: null,
      notes: 'Applications due Feb 7 - may have passed'
    },
    {
      id: 'st-002',
      title: 'Trading Analytics Dashboard with Journal',
      sponsor: 'Deriverse',
      platform: 'Superteam Earn',
      url: 'https://superteam.fun/earn/listing/design-trading-analytics-dashboard-with-journal-and-portfolio-analysis/',
      category: 'Development',
      prizePool: 800,
      currency: 'USDC',
      deadline: '2026-01-30',
      status: 'submitted',
      skills: ['Frontend', 'React', 'Data Viz'],
      description: 'Built Deriverse-style trading dashboard',
      submissionUrl: 'https://github.com/ebreen/deriverse-dashboard',
      mySubmission: {
        date: '2026-01-29',
        status: 'pending-review',
        deliverables: ['CLI dashboard', 'Web dashboard', 'Chart.js integration']
      },
      notes: 'Already built and submitted!'
    }
  ],
  other: [
    {
      id: 'sol-001',
      title: 'Solana Foundation Grants',
      sponsor: 'Solana Foundation',
      platform: 'Direct',
      url: 'https://solana.org/grants',
      category: 'Grant',
      prizePool: 0,
      currency: 'USDC',
      deadline: 'rolling',
      status: 'watching',
      skills: ['Various'],
      description: 'Open source tool development grants',
      submissionUrl: null,
      mySubmission: null,
      notes: 'Good for tool development'
    },
    {
      id: 'sol-002',
      title: 'Colosseum Hackathon',
      sponsor: 'Colosseum',
      platform: 'Colosseum',
      url: 'https://colosseum.org',
      category: 'Hackathon',
      prizePool: 1000000,
      currency: 'USDC',
      deadline: '2026-03-15',
      status: 'watching',
      skills: ['Full Stack', 'Web3', 'Design'],
      description: 'Major Solana hackathon',
      submissionUrl: null,
      mySubmission: null,
      notes: 'Consider entering with trading tools'
    }
  ]
};

// Load or initialize data
function loadData() {
  try {
    if (fs.existsSync(BOUNTY_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(BOUNTY_DATA_FILE, 'utf8'));
      return { ...DEFAULT_BOUNTIES, ...data };
    }
  } catch (err) {
    console.error('Error loading bounty data:', err.message);
  }
  return DEFAULT_BOUNTIES;
}

// Save data
function saveData(data) {
  try {
    fs.writeFileSync(BOUNTY_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving bounty data:', err.message);
  }
}

// Format helpers
const formatMoney = (amount, currency) => {
  if (amount >= 1000000) return `$${(amount/1000000).toFixed(1)}M ${currency}`;
  if (amount >= 1000) return `$${(amount/1000).toFixed(0)}k ${currency}`;
  return `$${amount} ${currency}`;
};

const formatStatus = (status) => {
  const icons = {
    'watching': '👀',
    'applied': '📤',
    'submitted': '✅',
    'pending-review': '⏳',
    'won': '🏆',
    'lost': '❌',
    'closing-today': '⏰',
    'expired': '💀'
  };
  return `${icons[status] || '⚪'} ${status}`;
};

const daysUntil = (dateStr) => {
  if (dateStr === 'rolling') return Infinity;
  const target = new Date(dateStr);
  const today = new Date();
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
};

// Display functions
function showHeader() {
  console.log('\n' + '='.repeat(70));
  console.log('🏆 BOUNTY HUNTER TRACKER');
  console.log('='.repeat(70));
  console.log(`📅 ${new Date().toISOString().split('T')[0]} | Tracking Solana earning opportunities`);
  console.log('='.repeat(70) + '\n');
}

function showStats(data) {
  const allBounties = [...data.superteam, ...data.other];
  const totalPrize = allBounties.reduce((sum, b) => sum + (b.prizePool || 0), 0);
  const active = allBounties.filter(b => ['watching', 'applied', 'submitted', 'pending-review'].includes(b.status));
  const submitted = allBounties.filter(b => ['submitted', 'pending-review'].includes(b.status));
  const won = allBounties.filter(b => b.status === 'won');
  const closingSoon = allBounties.filter(b => daysUntil(b.deadline) <= 7 && daysUntil(b.deadline) >= 0);

  console.log('📊 BOUNTY STATS');
  console.log('-'.repeat(70));
  console.log(`   Total Opportunities:  ${allBounties.length}`);
  console.log(`   Total Prize Pool:     ${formatMoney(totalPrize, 'USDC')}`);
  console.log(`   Active Tracking:      ${active.length}`);
  console.log(`   Submitted:            ${submitted.length}`);
  console.log(`   Won:                  ${won.length}`);
  console.log(`   Closing This Week:    ${closingSoon.length}`);
  console.log();
}

function showBounties(bounties, title) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`${title} (${bounties.length})`);
  console.log(`${'─'.repeat(70)}`);
  
  if (bounties.length === 0) {
    console.log('   No bounties to display.');
    return;
  }

  bounties.forEach(b => {
    const days = daysUntil(b.deadline);
    const deadlineStr = b.deadline === 'rolling' ? '🔄 Rolling' : 
                       days < 0 ? '💀 Expired' :
                       days === 0 ? '⏰ TODAY!' :
                       days <= 3 ? `🔥 ${days} days` :
                       `📅 ${days} days`;
    
    console.log(`\n   🎯 ${b.title}`);
    console.log(`      Sponsor:    ${b.sponsor}`);
    console.log(`      Prize:      ${formatMoney(b.prizePool, b.currency)}`);
    console.log(`      Deadline:   ${deadlineStr} (${b.deadline})`);
      console.log(`      Status:     ${formatStatus(b.status)}`);
    console.log(`      Category:   ${b.category}`);
    console.log(`      Skills:     ${b.skills.join(', ')}`);
    if (b.mySubmission) {
      console.log(`      Submitted:  ${b.mySubmission.date}`);
      console.log(`      Review:     ${b.mySubmission.status}`);
    }
    if (b.notes) {
      console.log(`      Notes:      ${b.notes}`);
    }
    console.log(`      URL:        ${b.url}`);
  });
}

function showClosingSoon(data) {
  const allBounties = [...data.superteam, ...data.other];
  const closingSoon = allBounties
    .filter(b => daysUntil(b.deadline) <= 7 && daysUntil(b.deadline) >= 0)
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));
  
  if (closingSoon.length > 0) {
    showBounties(closingSoon, '⏰ CLOSING SOON');
  }
}

function showWinnings(data) {
  const allBounties = [...data.superteam, ...data.other];
  const won = allBounties.filter(b => b.status === 'won');
  const totalWon = won.reduce((sum, b) => sum + (b.mySubmission?.prizeWon || 0), 0);
  
  console.log('\n' + '='.repeat(70));
  console.log('🏆 WINNINGS');
  console.log('='.repeat(70));
  console.log(`   Bounties Won: ${won.length}`);
  console.log(`   Total Earned: ${formatMoney(totalWon, 'USDC')}`);
  
  if (won.length > 0) {
    won.forEach(b => {
      console.log(`\n   ✅ ${b.title}`);
      console.log(`      Prize: ${formatMoney(b.mySubmission.prizeWon, b.currency)}`);
      console.log(`      Date:  ${b.mySubmission.date}`);
    });
  } else {
    console.log('\n   No winnings yet. Keep building! 🚀');
  }
  console.log();
}

function showRecommendations(data) {
  console.log('\n' + '='.repeat(70));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  const allBounties = [...data.superteam, ...data.other];
  const recommendations = [];
  
  // Check for closing soon
  const closingSoon = allBounties.filter(b => daysUntil(b.deadline) <= 3 && daysUntil(b.deadline) >= 0 && b.status === 'watching');
  if (closingSoon.length > 0) {
    recommendations.push(`⏰ ${closingSoon.length} bounties closing soon - consider applying!`);
  }
  
  // Check for no activity
  const active = allBounties.filter(b => ['watching', 'applied'].includes(b.status));
  if (active.length === 0) {
    recommendations.push('🔍 No active bounties being tracked - search for new opportunities');
  }
  
  // Check for submitted but no response
  const pending = allBounties.filter(b => b.status === 'pending-review');
  if (pending.length > 0) {
    recommendations.push(`⏳ ${pending.length} submissions pending review - follow up if overdue`);
  }
  
  // Tool-based recommendations
  recommendations.push('🛠️  Build tools that showcase your Solana skills:');
  recommendations.push('   • Trading dashboard (like Deriverse)');
  recommendations.push('   • Protocol analytics tool');
  recommendations.push('   • Developer utility for Solana');
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All caught up! Keep monitoring for new bounties.');
  }
  
  recommendations.forEach(r => console.log(`   ${r}`));
  console.log();
}

// Command handlers
function addBounty(data, args) {
  // Parse args: --title "X" --sponsor "Y" --prize 1000 --deadline 2026-02-15 --url "Z"
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  
  const title = getArg('--title');
  const sponsor = getArg('--sponsor') || 'Unknown';
  const prize = parseInt(getArg('--prize')) || 0;
  const deadline = getArg('--deadline') || 'rolling';
  const url = getArg('--url') || '';
  const category = getArg('--category') || 'Development';
  
  if (!title) {
    console.log('❌ Error: --title is required');
    return;
  }
  
  const newBounty = {
    id: `manual-${Date.now()}`,
    title,
    sponsor,
    platform: 'Manual',
    url,
    category,
    prizePool: prize,
    currency: 'USDC',
    deadline,
    status: 'watching',
    skills: [],
    description: '',
    submissionUrl: null,
    mySubmission: null,
    notes: 'Added manually'
  };
  
  if (!data.manual) data.manual = [];
  data.manual.push(newBounty);
  saveData(data);
  
  console.log(`✅ Added bounty: ${title}`);
  console.log(`   Prize: ${formatMoney(prize, 'USDC')}`);
  console.log(`   Deadline: ${deadline}`);
}

function updateStatus(data, args) {
  const id = args[0];
  const newStatus = args[1];
  
  if (!id || !newStatus) {
    console.log('❌ Usage: update <id> <status>');
    console.log('   Status options: watching, applied, submitted, pending-review, won, lost');
    return;
  }
  
  const allBounties = [...data.superteam, ...data.other, ...(data.manual || [])];
  const bounty = allBounties.find(b => b.id === id);
  
  if (!bounty) {
    console.log(`❌ Bounty not found: ${id}`);
    return;
  }
  
  bounty.status = newStatus;
  
  if (newStatus === 'submitted' || newStatus === 'pending-review') {
    bounty.mySubmission = {
      date: new Date().toISOString().split('T')[0],
      status: 'pending-review',
      deliverables: []
    };
  }
  
  saveData(data);
  console.log(`✅ Updated ${bounty.title} to ${newStatus}`);
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const data = loadData();
  
  switch (command) {
    case 'add':
      addBounty(data, args.slice(1));
      break;
    case 'update':
      updateStatus(data, args.slice(1));
      break;
    case 'stats':
      showHeader();
      showStats(data);
      break;
    case 'closing':
      showHeader();
      showClosingSoon(data);
      break;
    case 'won':
      showWinnings(data);
      break;
    case 'list':
      showHeader();
      showBounties(data.superteam, 'SUPERTEAM EARN BOUNTIES');
      showBounties(data.other, 'OTHER OPPORTUNITIES');
      if (data.manual) {
        showBounties(data.manual, 'MANUALLY TRACKED');
      }
      break;
    default:
      showHeader();
      showStats(data);
      showClosingSoon(data);
      showBounties(data.superteam.filter(b => b.status !== 'expired'), 'SUPERTEAM EARN BOUNTIES');
      showBounties(data.other.filter(b => b.status !== 'expired'), 'OTHER OPPORTUNITIES');
      showRecommendations(data);
  }
}

// Help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node bounty-tracker.js [command] [options]

Commands:
  (none)              Show full dashboard
  list                List all bounties
  stats               Show statistics only
  closing             Show bounties closing soon
  won                 Show winnings summary
  add [options]       Add a new bounty
    --title "X"       Bounty title (required)
    --sponsor "Y"     Sponsor name
    --prize 1000      Prize amount in USDC
    --deadline DATE   Deadline (YYYY-MM-DD or 'rolling')
    --url "Z"         Bounty URL
    --category "Cat"  Category (default: Development)
  update <id> <status> Update bounty status

Examples:
  node bounty-tracker.js
  node bounty-tracker.js list
  node bounty-tracker.js add --title "New Bounty" --sponsor "Acme" --prize 500 --deadline 2026-02-15
  node bounty-tracker.js update st-001 applied
`);
  process.exit(0);
}

main();
