# Frontend (React + Tailwind CSS)

## Overview

Modern, responsive React frontend for the blockchain wallet system with:
- ✅ Complete authentication flow
- ✅ Wallet dashboard with real-time balance
- ✅ Send money interface with validation
- ✅ Transaction history (sent/received/pending)
- ✅ Block explorer with mining capability
- ✅ Analytics and reports
- ✅ System and transaction logs viewer
- ✅ Responsive Tailwind CSS design
- ✅ Context-based state management

## Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

1. Navigate to frontend directory:
```powershell
cd frontend
```

2. Install dependencies:
```powershell
npm install
```

3. Run development server:
```powershell
npm run dev
```

The app starts on `http://localhost:3000`

## Configuration

### API Endpoint

The frontend is configured to proxy API requests to `http://localhost:8080` via Vite config.

To change the backend URL, edit `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://your-backend-url:8080',
      changeOrigin: true,
    }
  }
}
```

## Pages

### 1. Login/Register
- Generate new keypair
- Create wallet with name and email
- Login with wallet ID and private key
- Secure key storage in localStorage

### 2. Dashboard
- Current balance display
- Total sent/received statistics
- Available UTXOs list
- Wallet information panel
- Quick stats overview

### 3. Send Money
- Recipient wallet ID input
- Amount and optional note
- Transaction creation with validation
- Real-time feedback
- Error handling

### 4. Transactions
- All transactions view
- Filter by: All, Sent, Received, Pending
- Transaction details (amount, note, timestamp)
- Zakat transaction highlighting
- Real-time updates

### 5. Block Explorer
- Complete blockchain viewer
- Mine new blocks
- System statistics dashboard
- Block details modal
- Transaction listing per block
- Mining animation

### 6. Reports
- Wallet analytics
- System-wide statistics
- Zakat information
- Transaction counts
- Visual metrics

### 7. Logs
- System event logs
- Transaction logs
- Filtering and search
- Timestamp tracking
- Event type categorization

## Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Login.jsx          # Auth page
│   │   ├── Dashboard.jsx      # Main dashboard
│   │   ├── SendMoney.jsx      # Send TX
│   │   ├── Transactions.jsx   # TX history
│   │   ├── BlockExplorer.jsx  # Blockchain
│   │   ├── Reports.jsx        # Analytics
│   │   └── Logs.jsx           # System logs
│   ├── components/
│   │   └── Navbar.jsx         # Navigation
│   ├── context/
│   │   └── WalletContext.jsx  # Global state
│   ├── api/
│   │   └── client.js          # API client
│   ├── App.jsx                # Main app
│   ├── main.jsx               # Entry point
│   └── index.css              # Tailwind styles
├── public/
├── index.html
├── vite.config.js
├── tailwind.config.cjs
├── postcss.config.cjs
└── package.json
```

## Development

### Run Dev Server
```powershell
npm run dev
```

### Build for Production
```powershell
npm run build
```

Output in `dist/` directory

### Preview Production Build
```powershell
npm run preview
```

## State Management

Uses React Context API for global state:
- Current wallet info
- Private key (secure storage)
- Login/logout functionality
- Persistent localStorage

## API Integration

All API calls go through `src/api/client.js`:

```javascript
import { api } from '../api/client';

// Example usage
const balance = await api.getBalance(walletId);
const transactions = await api.getTransactions();
```

## Styling

### Tailwind CSS
All styling uses Tailwind utility classes:
- Responsive design (mobile-first)
- Custom color palette
- Consistent spacing
- Modern animations

### Color Scheme
- Primary: Indigo (600-800)
- Success: Green (600-800)
- Error: Red (600-800)
- Warning: Orange/Yellow
- Zakat: Purple (for Islamic finance)

## Features

### Real-time Updates
- Auto-refresh balance
- Transaction status tracking
- Block mining feedback
- System logs updating

### Validation
- Input validation on forms
- Balance checking before send
- Wallet ID format validation
- Error messages and feedback

### User Experience
- Loading states
- Success/error notifications
- Modal dialogs
- Responsive navigation
- Touch-friendly mobile design

## Security

### Client-Side
- Private keys stored in localStorage (encrypt for production)
- Never display full private keys
- Input sanitization
- HTTPS recommended for production

### Best Practices
- Clear error messages
- Loading indicators
- Graceful error handling
- User confirmation for actions

## Browser Support

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### API Calls Fail
- Ensure backend is running on port 8080
- Check CORS configuration
- Verify API endpoint in vite.config.js

### Build Errors
```powershell
# Clear node_modules and reinstall
rm -r node_modules
npm install
```

### Styles Not Loading
```powershell
# Rebuild Tailwind
npm run dev
```

## Deployment

### Vercel (Recommended)
```powershell
npm i -g vercel
vercel
```

### Netlify
```powershell
npm run build
netlify deploy --prod --dir=dist
```

### Static Hosting
Upload `dist/` folder contents to any static host.

## Environment Variables

Create `.env` file:
```env
VITE_API_URL=http://localhost:8080
```

Access in code:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Future Enhancements

- [ ] WebSocket for real-time updates
- [ ] Dark mode toggle
- [ ] Multi-language support
- [ ] QR code wallet addresses
- [ ] Transaction history export (CSV/PDF)
- [ ] Advanced analytics charts
- [ ] Mobile app (React Native)
- [ ] Biometric authentication

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md)

## License

Educational project for blockchain learning.
