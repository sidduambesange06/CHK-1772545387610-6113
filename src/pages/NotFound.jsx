import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import './NotFound.css'

export default function NotFound() {
  return (
    <Layout>
      <div className="not-found-container">
        <div className="not-found-content">
          {/* Left Side - Text Content */}
          <div className="not-found-text">
            <div className="not-found-logo">
              <span className="material-symbols-outlined">fingerprint</span>
              <span>AI FORENSICS</span>
            </div>
            
            <h1 className="not-found-title">SORRY !!!</h1>
            <p className="not-found-subtitle">PAGE NOT FOUND</p>
            
            <p className="not-found-description">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do 
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            
            <Link to="/" className="not-found-button">
              <span className="material-symbols-outlined">arrow_back</span>
              Go Back
            </Link>
          </div>

          {/* Right Side - 404 Illustration */}
          <div className="not-found-illustration">
            <div className="error-code">404</div>
            <div className="cable-container">
              <svg className="cable left-cable" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M 10 75 Q 60 20, 110 75" 
                  stroke="#2563EB" 
                  strokeWidth="8" 
                  fill="none" 
                  strokeLinecap="round"
                />
              </svg>
              
              {/* Left Plug */}
              <div className="plug left-plug">
                <div className="plug-body"></div>
                <div className="plug-prongs">
                  <div className="prong"></div>
                  <div className="prong"></div>
                </div>
              </div>

              {/* Right Plug */}
              <div className="plug right-plug">
                <div className="plug-body"></div>
                <div className="plug-prongs">
                  <div className="prong"></div>
                  <div className="prong"></div>
                </div>
              </div>

              <svg className="cable right-cable" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M 90 75 Q 140 20, 190 75" 
                  stroke="#2563EB" 
                  strokeWidth="8" 
                  fill="none" 
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="illustration-text">Sorry, Page Not Found</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
