# Product Management Tool
## Overview
A web-based application to help product managers visually plan, track, and collaborate on product roadmaps with integrated customer persona building and feedback analysis.

## Features
- Interactive timeline and Gantt chart views
- Drag-and-drop Kanban board for feature/task management
- Milestone tracking and weatherboarding
- Export/share roadmaps via public links or PDF
- CRUD APIs for roadmaps, features, and personas
- Customer persona builder and feedback dashboard
- Secure authentication and real-time collaboration

## Tech Stack
- Python 3.x, Flask, SQLAlchemy
- SQLite / PostgreSQL (via SQLALCHEMY_DATABASE_URI)
- Firebase Admin SDK for authentication
- JavaScript, Bootstrap, Jinja2 templates
- dotenv for configuration management
- Optional: Node.js with Firebase client SDK for front-end integration

## Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd product-roadmap-planner
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate    # Linux/Mac
   venv\Scripts\activate     # Windows
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. (Optional) Install frontend dependencies if modifying or extending static assets:
   ```bash
   npm install
   ```

## Configuration
Create a `.env` file in the project root and set the following variables:
```bash
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///roadmap.db      # or your Postgres URL
GOOGLE_APPLICATION_CREDENTIALS=path/to/firebase-credentials.json

# Firebase front-end config
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
FIREBASE_APP_ID=your-firebase-app-id
FIREBASE_MEASUREMENT_ID=your-firebase-measurement-id
``` 

## Running the Application
```bash
# Initialize database (development only)
python app.py --init-db

# Start Flask server
flask run --host=0.0.0.0 --port=5000
``` 
Visit http://localhost:5000 in your browser.

## API Endpoints
### Roadmaps
- `GET /api/roadmaps` — list all roadmaps
- `POST /api/roadmaps` — create a new roadmap

### Features
- `GET /api/roadmaps/<roadmap_id>/features` — list features for a roadmap
- `POST /api/roadmaps/<roadmap_id>/features` — add a feature to a roadmap
- `GET /api/features` — list all features
- `POST /api/features` — create a feature
- `PUT /api/features/<feature_id>` — update a feature
- `DELETE /api/features/<feature_id>` — delete a feature

### Personas
- `GET /api/personas` — list all personas
- `POST /api/personas` — create a persona
- `PUT /api/personas/<persona_id>` — update a persona
- `DELETE /api/personas/<persona_id>` — delete a persona

## Environment Variables
- `SECRET_KEY` — Flask application secret key
- `DATABASE_URL` — SQLAlchemy database connection URI
- `GOOGLE_APPLICATION_CREDENTIALS` — path to Firebase service account JSON

## License
This project is licensed under a proprietary license. See the `LICENSE` file for details.

## Author
Nanabanyin Abbiw 
