# AI Forensics Backend Integration

A full-stack deepfake and image manipulation detection system for the Chakravyuh 2.0 hackathon. This system combines Error Level Analysis (ELA) and deep learning algorithms with cryptographic evidence chain management for forensic integrity.

## Features

- **Multi-Algorithm Analysis**: Combines ELA (40%) and EfficientNet (60%) for robust detection
- **Visual Heatmaps**: Highlights manipulated regions with color-coded overlays
- **Evidence Chain**: SHA-256 based chain of custody for forensic integrity
- **PDF Reports**: Generate downloadable forensic analysis reports
- **History Tracking**: View and search all analyzed images
- **Real-time Analysis**: Sub-10-second processing for typical images
- **Responsive UI**: Works on desktop and mobile devices

## Technology Stack

### Backend
- Python 3.9+
- FastAPI (web framework)
- Pillow (image processing)
- NumPy (numerical operations)
- Matplotlib (visualization)
- ReportLab (PDF generation)

### Frontend
- React 18
- Vite (build tool)
- Tailwind CSS (styling)
- Axios (HTTP client)
- React Router (navigation)

## Project Structure

```
.
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── forensics.py            # Analysis algorithms
│   ├── hash_chain.py           # Evidence chain management
│   ├── models.py               # Pydantic models
│   ├── config.py               # Configuration
│   ├── logging_config.py       # Logging setup
│   ├── requirements.txt        # Python dependencies
│   ├── temp/                   # Temporary files
│   ├── reports/                # Generated PDF reports
│   ├── logs/                   # Application logs
│   └── tests/                  # Test files
│
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API client
│   │   ├── hooks/              # Custom hooks
│   │   ├── utils/              # Utility functions
│   │   ├── App.jsx             # Main app component
│   │   └── main.jsx            # Entry point
│   ├── package.json            # Node dependencies
│   ├── vite.config.js          # Vite configuration
│   └── tailwind.config.js      # Tailwind configuration
│
└── README.md                   # This file
```

## Setup Instructions

### Backend Setup

1. **Create Python virtual environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables** (optional):
   Create a `.env` file in the backend directory:
   ```
   HOST=0.0.0.0
   PORT=8000
   CORS_ORIGINS=http://localhost:5173
   TEMP_DIR=./temp
   REPORTS_DIR=./reports
   EVIDENCE_CHAIN_PATH=./evidence_chain.json
   LOG_LEVEL=INFO
   ```

4. **Start the backend server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

   The API will be available at `http://localhost:8000`
   - API docs: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

### Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment variables** (optional):
   Create a `.env` file in the frontend directory:
   ```
   VITE_API_URL=http://localhost:8000
   VITE_MAX_FILE_SIZE=10485760
   VITE_SUPPORTED_FORMATS=image/jpeg,image/png
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

## API Endpoints

### Health Check
```
GET /health
```
Returns service status and version information.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-08T12:00:00",
  "version": "1.0.0",
  "services": {
    "ela_analyzer": "ready",
    "efficientnet_model": "ready",
    "hash_manager": "ready"
  }
}
```

### Analyze Image
```
POST /analyze
Content-Type: multipart/form-data

file: <image file>
```

Analyzes an uploaded image for manipulation.

**Response**:
```json
{
  "confidence_score": 75.5,
  "classification": "Manipulated",
  "ela_score": 70.0,
  "efficientnet_score": 80.0,
  "heatmap_base64": "iVBORw0KGgo...",
  "file_hash": "abc123...",
  "timestamp": "2026-03-08T12:00:00+05:30",
  "processing_time": 2.5
}
```

### Generate Report
```
POST /report
?filename=image.jpg&confidence_score=75.5&classification=Manipulated&ela_score=70.0&efficientnet_score=80.0&heatmap_base64=iVBORw0KGgo...
```

Generates a PDF forensic report.

**Response**: PDF file download

### Get History
```
GET /history?page=1&limit=50
```

Retrieves analysis history.

**Response**:
```json
{
  "records": [
    {
      "filename": "image.jpg",
      "file_hash": "abc123...",
      "timestamp": "2026-03-08T12:00:00+05:30",
      "file_size": 102400,
      "confidence_score": 75.5,
      "classification": "Manipulated"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

## Usage

1. **Start both servers** (backend and frontend)
2. **Open the frontend** at `http://localhost:5173`
3. **Upload an image** using the drag-and-drop interface
4. **View results** including:
   - Combined confidence score
   - Individual ELA and EfficientNet scores
   - Classification (Authentic/Uncertain/Manipulated)
   - Visual heatmap overlay
5. **Download PDF report** of the analysis
6. **View history** of all analyzed images

## Classification Thresholds

- **Authentic**: Confidence score < 30
- **Uncertain**: Confidence score 30-70
- **Manipulated**: Confidence score > 70

## Scoring Formula

Combined Score = (ELA Score × 0.4) + (EfficientNet Score × 0.6)

## File Validation

- **Supported formats**: JPG, PNG
- **Maximum file size**: 10 MB
- **Validation**: File type and size checked on both frontend and backend

## Performance

- **Analysis time**: < 10 seconds for typical images
- **Health check response**: < 100 ms
- **Hash generation**: < 500 ms for files up to 10 MB
- **Concurrent requests**: Supports at least 10 simultaneous analyses

## Error Handling

The system provides detailed error messages for:
- Invalid file formats
- Oversized files
- Processing failures
- Network errors

All errors are logged with timestamps and stack traces for debugging.

## Logging

Logs are stored in `backend/logs/app.log` with the following information:
- API requests and responses
- File operations
- Analysis processing times
- Errors and exceptions

## Testing

### Run Backend Tests
```bash
cd backend
pytest
```

### Run Frontend Tests (if implemented)
```bash
cd frontend
npm test
```

## Build for Production

### Backend
```bash
# Use production ASGI server
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
npm run build
# Output in frontend/dist/
```

## Troubleshooting

### Backend won't start
- Check Python version (3.9+)
- Verify all dependencies installed: `pip install -r requirements.txt`
- Check port 8000 is available
- Review logs in `backend/logs/app.log`

### Frontend won't start
- Check Node.js version (14+)
- Clear node_modules: `rm -rf node_modules && npm install`
- Check port 5173 is available
- Verify VITE_API_URL is set correctly

### CORS errors
- Ensure backend CORS is configured for frontend URL
- Check `allow_origins` in `main.py`
- Verify frontend is accessing correct API URL

### Analysis fails
- Check image format (JPG/PNG only)
- Verify file size < 10 MB
- Check backend logs for detailed error
- Try with a different image

## Demo Preparation

### Sample Images
The system includes test images in `tests/fixtures/`:
- `authentic/`: Genuine, unmanipulated images
- `manipulated/`: Images with splicing, cloning, or other manipulations
- `edge_cases/`: Small, grayscale, or large images

### Demo Flow
1. Health check to verify system is running
2. Analyze authentic image (should score < 30)
3. Analyze manipulated image (should score > 70)
4. Show heatmap highlighting manipulated regions
5. Generate and download PDF report
6. View analysis history

## Future Enhancements

- Real EfficientNet model integration
- Additional forensic algorithms (JPEG ghost, copy-move detection)
- Batch processing for multiple images
- Advanced filtering and search in history
- User authentication and multi-user support
- Cloud storage integration
- Mobile app version

## License

This project is created for the Chakravyuh 2.0 hackathon.

## Support

For issues or questions, please refer to the API documentation at `http://localhost:8000/docs` or check the logs in `backend/logs/app.log`.

