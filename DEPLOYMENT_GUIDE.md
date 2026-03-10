# Deployment Guide - AI Forensics Backend Integration

## Quick Start (Development)

### Prerequisites
- Python 3.9 or higher
- Node.js 14 or higher
- npm or yarn

### Backend Setup (5 minutes)

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment**:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the backend server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

   The backend will be available at:
   - API: `http://localhost:8000`
   - Docs: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

### Frontend Setup (5 minutes)

1. **Navigate to frontend directory** (in a new terminal):
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

   The frontend will be available at:
   - App: `http://localhost:5173`

### Verify Integration

1. Open `http://localhost:5173` in your browser
2. Click on the upload area
3. Select a JPG or PNG image (< 10MB)
4. Wait for analysis to complete
5. View results with heatmap
6. Download PDF report
7. Check history page

## Production Deployment

### Backend Production Setup

1. **Install production dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set environment variables**:
   ```bash
   # Linux/macOS
   export HOST=0.0.0.0
   export PORT=8000
   export CORS_ORIGINS=https://yourdomain.com
   export LOG_LEVEL=INFO
   
   # Windows
   set HOST=0.0.0.0
   set PORT=8000
   set CORS_ORIGINS=https://yourdomain.com
   set LOG_LEVEL=INFO
   ```

3. **Start with production ASGI server**:
   ```bash
   # Using Gunicorn (recommended for Linux)
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:8000 main:app
   
   # Using Uvicorn (cross-platform)
   uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

### Frontend Production Build

1. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Output will be in `frontend/dist/`**

3. **Serve with a web server**:
   ```bash
   # Using Python
   cd dist
   python -m http.server 3000
   
   # Using Node.js
   npm install -g serve
   serve -s dist -l 3000
   
   # Using Nginx
   # Configure nginx to serve dist/ folder
   ```

## Docker Deployment (Optional)

### Backend Dockerfile

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t ai-forensics-backend .
docker run -p 8000:8000 ai-forensics-backend
```

### Frontend Dockerfile

Create `frontend/Dockerfile`:
```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t ai-forensics-frontend .
docker run -p 80:80 ai-forensics-frontend
```

## Environment Variables

### Backend (.env)
```
# Server
HOST=0.0.0.0
PORT=8000

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Directories
TEMP_DIR=./temp
REPORTS_DIR=./reports
EVIDENCE_CHAIN_PATH=./evidence_chain.json

# Analysis
ELA_QUALITY=95

# Logging
LOG_LEVEL=INFO
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
VITE_MAX_FILE_SIZE=10485760
VITE_SUPPORTED_FORMATS=image/jpeg,image/png
```

## Troubleshooting

### Backend Issues

**Port already in use**:
```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

**Module not found**:
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

**CORS errors**:
- Check `CORS_ORIGINS` in `.env`
- Verify frontend URL matches CORS configuration
- Check browser console for exact error

**Analysis fails**:
- Check image format (JPG/PNG only)
- Verify file size < 10MB
- Check backend logs: `backend/logs/app.log`

### Frontend Issues

**Blank page**:
- Check browser console for errors
- Verify `VITE_API_URL` is correct
- Check if backend is running

**API connection fails**:
- Verify backend is running on port 8000
- Check `VITE_API_URL` in `.env`
- Check CORS configuration on backend

**Build fails**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Performance Optimization

### Backend
- Use production ASGI server (Gunicorn/Uvicorn with workers)
- Enable caching for repeated analyses
- Use async processing for I/O operations
- Monitor memory usage for large files

### Frontend
- Enable gzip compression
- Minify CSS and JavaScript
- Use CDN for static assets
- Implement lazy loading for images

## Monitoring

### Backend Logs
```bash
# View logs
tail -f backend/logs/app.log

# Search for errors
grep ERROR backend/logs/app.log

# Monitor in real-time
watch -n 1 'tail -20 backend/logs/app.log'
```

### Health Check
```bash
# Check backend health
curl http://localhost:8000/health

# Check frontend
curl http://localhost:5173
```

## Backup and Recovery

### Evidence Chain Backup
```bash
# Backup evidence chain
cp backend/evidence_chain.json backend/evidence_chain.json.backup

# Restore from backup
cp backend/evidence_chain.json.backup backend/evidence_chain.json
```

### Database Backup
```bash
# Backup all data
tar -czf backup-$(date +%Y%m%d).tar.gz backend/evidence_chain.json backend/reports/
```

## Security Considerations

1. **File Upload Security**:
   - Validate file types (magic numbers, not just extensions)
   - Limit file size to 10MB
   - Scan for malware (optional)
   - Use temporary directories

2. **API Security**:
   - Enable HTTPS in production
   - Implement rate limiting
   - Add authentication if needed
   - Validate all inputs

3. **Data Security**:
   - Encrypt sensitive data
   - Use secure file permissions
   - Regular backups
   - Monitor access logs

## Scaling

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Run multiple backend instances
- Use shared storage for evidence chain
- Implement session management

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Optimize database queries
- Use caching layer (Redis)
- Implement connection pooling

## Maintenance

### Regular Tasks
- Monitor disk space
- Check log files
- Verify backups
- Update dependencies
- Monitor performance metrics

### Update Dependencies
```bash
# Backend
pip list --outdated
pip install --upgrade <package>

# Frontend
npm outdated
npm update
```

## Support

For issues or questions:
1. Check logs: `backend/logs/app.log`
2. Review API docs: `http://localhost:8000/docs`
3. Check browser console for frontend errors
4. Verify environment variables are set correctly

---

**Last Updated:** March 8, 2026
**Version:** 1.0.0
