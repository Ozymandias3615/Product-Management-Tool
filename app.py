from flask import Flask, render_template, request, jsonify, redirect, url_for, Response
from firebase_admin import credentials, initialize_app, auth
import os
from dotenv import load_dotenv
from flask_cors import CORS
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///roadmap.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# Roadmap model
class Roadmap(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)

# Feature model (link to roadmap)
class Feature(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.String(20))
    status = db.Column(db.String(20))
    release = db.Column(db.String(100))
    roadmap_id = db.Column(db.Integer, db.ForeignKey('roadmap.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)

# Persona model for customer persona builder
class Persona(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer)
    job_title = db.Column(db.String(100))
    demographics = db.Column(db.Text)
    behaviors = db.Column(db.Text)
    goals = db.Column(db.Text)
    pains = db.Column(db.Text)

# Create database tables on startup
def init_db():
    # Create tables if they don't exist (preserves existing data)
    db.create_all()

# API to get all roadmaps
@app.route('/api/roadmaps', methods=['GET'])
def get_roadmaps():
    rms = Roadmap.query.order_by(Roadmap.id).all()
    return jsonify([{'id': r.id, 'name': r.name} for r in rms]), 200

# API to create a new roadmap
@app.route('/api/roadmaps', methods=['POST'])
def add_roadmap():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    rm = Roadmap(name=name)
    db.session.add(rm)
    db.session.commit()
    return jsonify({'id': rm.id, 'name': rm.name}), 201

# API to get features by roadmap
@app.route('/api/roadmaps/<int:roadmap_id>/features', methods=['GET'])
def get_features_by_roadmap(roadmap_id):
    features = Feature.query.filter_by(roadmap_id=roadmap_id).order_by(Feature.date).all()
    result = []
    for f in features:
        result.append({
            'id': f.id,
            'title': f.title,
            'description': f.description,
            'priority': f.priority,
            'status': f.status,
            'release': f.release,
            'date': f.date.isoformat()
        })
    return jsonify(result), 200

# API to add a new feature to a roadmap
@app.route('/api/roadmaps/<int:roadmap_id>/features', methods=['POST'])
def add_feature_to_roadmap(roadmap_id):
    data = request.json
    try:
        feature = Feature(
            title=data.get('title'),
            description=data.get('description',''),
            priority=data.get('priority',''),
            status=data.get('status',''),
            release=data.get('release',None),
            date=datetime.fromisoformat(data.get('date')).date(),
            roadmap_id=roadmap_id
        )
        db.session.add(feature)
        db.session.commit()
        return jsonify({
            'id': feature.id,
            'title': feature.title,
            'description': feature.description,
            'priority': feature.priority,
            'status': feature.status,
            'release': feature.release,
            'date': feature.date.isoformat()
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# API to get all features
@app.route('/api/features', methods=['GET'])
def get_features():
    features = Feature.query.order_by(Feature.date).all()
    result = []
    for f in features:
        result.append({
            'id': f.id,
            'title': f.title,
            'description': f.description,
            'priority': f.priority,
            'status': f.status,
            'release': f.release,
            'date': f.date.isoformat()
        })
    return jsonify(result), 200

# API to add a new feature
@app.route('/api/features', methods=['POST'])
def add_feature():
    data = request.json
    try:
        feature = Feature(
            title=data.get('title'),
            description=data.get('description', ''),
            priority=data.get('priority', ''),
            status=data.get('status', ''),
            release=data.get('release', None),
            date=datetime.fromisoformat(data.get('date')).date()
        )
        db.session.add(feature)
        db.session.commit()
        return jsonify({
            'id': feature.id,
            'title': feature.title,
            'description': feature.description,
            'priority': feature.priority,
            'status': feature.status,
            'release': feature.release,
            'date': feature.date.isoformat()
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# API to update an existing feature
@app.route('/api/features/<int:feature_id>', methods=['PUT'])
def update_feature(feature_id):
    data = request.json
    feature = Feature.query.get(feature_id)
    if not feature:
        return jsonify({'error': 'Feature not found'}), 404
    try:
        feature.title = data.get('title', feature.title)
        feature.description = data.get('description', feature.description)
        feature.priority = data.get('priority', feature.priority)
        feature.status = data.get('status', feature.status)
        feature.release = data.get('release', feature.release)
        feature.date = datetime.fromisoformat(data.get('date')).date()
        db.session.commit()
        return jsonify({
            'id': feature.id,
            'title': feature.title,
            'description': feature.description,
            'priority': feature.priority,
            'status': feature.status,
            'release': feature.release,
            'date': feature.date.isoformat()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# API to delete a feature
@app.route('/api/features/<int:feature_id>', methods=['DELETE'])
def delete_feature(feature_id):
    feature = Feature.query.get(feature_id)
    if not feature:
        return jsonify({'error': 'Feature not found'}), 404
    try:
        db.session.delete(feature)
        db.session.commit()
        return jsonify({}), 204
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# API to get all personas
@app.route('/api/personas', methods=['GET'])
def get_personas():
    personas = Persona.query.order_by(Persona.id).all()
    result = []
    for p in personas:
        result.append({
            'id': p.id,
            'name': p.name,
            'age': p.age,
            'job_title': p.job_title,
            'demographics': p.demographics,
            'behaviors': p.behaviors,
            'goals': p.goals,
            'pains': p.pains
        })
    return jsonify(result), 200

# API to add a new persona
@app.route('/api/personas', methods=['POST'])
def add_persona():
    data = request.json
    try:
        persona = Persona(
            name=data.get('name'),
            age=data.get('age'),
            job_title=data.get('job_title'),
            demographics=data.get('demographics',''),
            behaviors=data.get('behaviors',''),
            goals=data.get('goals',''),
            pains=data.get('pains','')
        )
        db.session.add(persona)
        db.session.commit()
        return jsonify({
            'id': persona.id,
            'name': persona.name,
            'age': persona.age,
            'job_title': persona.job_title,
            'demographics': persona.demographics,
            'behaviors': persona.behaviors,
            'goals': persona.goals,
            'pains': persona.pains
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# API to update an existing persona
@app.route('/api/personas/<int:persona_id>', methods=['PUT'])
def update_persona(persona_id):
    persona = Persona.query.get(persona_id)
    if not persona:
        return jsonify({'error': 'Persona not found'}), 404
    data = request.json
    try:
        persona.name = data.get('name', persona.name)
        persona.age = data.get('age', persona.age)
        persona.job_title = data.get('job_title', persona.job_title)
        persona.demographics = data.get('demographics', persona.demographics)
        persona.behaviors = data.get('behaviors', persona.behaviors)
        persona.goals = data.get('goals', persona.goals)
        persona.pains = data.get('pains', persona.pains)
        db.session.commit()
        return jsonify({
            'id': persona.id,
            'name': persona.name,
            'age': persona.age,
            'job_title': persona.job_title,
            'demographics': persona.demographics,
            'behaviors': persona.behaviors,
            'goals': persona.goals,
            'pains': persona.pains
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# API to delete a persona
@app.route('/api/personas/<int:persona_id>', methods=['DELETE'])
def delete_persona(persona_id):
    persona = Persona.query.get(persona_id)
    if not persona:
        return jsonify({'error': 'Persona not found'}), 404
    try:
        db.session.delete(persona)
        db.session.commit()
        return jsonify({}), 204
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Initialize Firebase Admin
try:
    cred = credentials.Certificate('firebase-credentials.json')
    firebase_app = initialize_app(cred)
except FileNotFoundError:
    print("Warning: firebase-credentials.json not found. Authentication will not work.")
    firebase_app = None

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/roadmaps')
def roadmaps():
    return render_template('index.html')

@app.route('/roadmap')
def roadmap_root():
    return redirect(url_for('roadmaps'))

@app.route('/roadmap/<int:roadmap_id>')
def roadmap(roadmap_id):
    # Fetch the roadmap by ID and pass its name to the template
    rm = Roadmap.query.get_or_404(roadmap_id)
    return render_template('roadmap.html', roadmap_id=roadmap_id, roadmap_name=rm.name)

@app.route('/api/verify-token', methods=['POST'])
def verify_token():
    if not firebase_app:
        return jsonify({'error': 'Firebase not initialized'}), 500
        
    token = request.json.get('token')
    if not token:
        return jsonify({'error': 'No token provided'}), 400
        
    try:
        decoded_token = auth.verify_id_token(token)
        return jsonify({'uid': decoded_token['uid']}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 401

# Demo route to create and view a sample roadmap
@app.route('/demo')
def demo():
    # Check or create demo project
    demo_rm = Roadmap.query.filter_by(name='Product Compass Demo').first()
    if not demo_rm:
        demo_rm = Roadmap(name='Product Compass Demo')
        db.session.add(demo_rm)
        db.session.commit()

        # Add comprehensive sample features covering all product capabilities
        samples = [
            # Core Product Features
            {'title': 'Drag-and-Drop Interface', 'description': 'Intuitive drag-and-drop interface for roadmap planning and task management.', 'priority': 'high', 'status': 'completed', 'release': 'Core Features', 'date': datetime.today().date()},
            {'title': 'Timeline Views', 'description': 'Multiple timeline views including monthly, quarterly, and sprint-based planning.', 'priority': 'high', 'status': 'completed', 'release': 'Core Features', 'date': datetime.today().date()},
            {'title': 'Kanban Board', 'description': 'Visual task management with customizable columns and drag-drop functionality.', 'priority': 'high', 'status': 'completed', 'release': 'Core Features', 'date': datetime.today().date()},
            
            # In Progress Features
            {'title': 'Gantt Chart Integration', 'description': 'Interactive Gantt charts for timeline visualization and dependency mapping.', 'priority': 'high', 'status': 'in-progress', 'release': 'Advanced Planning', 'date': (datetime.today() + timedelta(days=30)).date()},
            {'title': 'Team Collaboration', 'description': 'Real-time collaboration features including comments, mentions, and notifications.', 'priority': 'medium', 'status': 'in-progress', 'release': 'Advanced Planning', 'date': (datetime.today() + timedelta(days=45)).date()},
            {'title': 'Resource Management', 'description': 'Team workload tracking and resource allocation features.', 'priority': 'medium', 'status': 'in-progress', 'release': 'Advanced Planning', 'date': (datetime.today() + timedelta(days=60)).date()},
            
            # Upcoming Features
            {'title': 'Customer Feedback Portal', 'description': 'Dedicated portal for collecting and organizing customer feedback and feature requests.', 'priority': 'high', 'status': 'planned', 'release': 'Customer Insights', 'date': (datetime.today() + timedelta(days=90)).date()},
            {'title': 'Persona Builder', 'description': 'Tools for creating and managing detailed customer personas.', 'priority': 'medium', 'status': 'planned', 'release': 'Customer Insights', 'date': (datetime.today() + timedelta(days=90)).date()},
            {'title': 'Analytics Dashboard', 'description': 'Comprehensive analytics for tracking project progress and team performance.', 'priority': 'medium', 'status': 'planned', 'release': 'Customer Insights', 'date': (datetime.today() + timedelta(days=120)).date()},
            
            # Future Enhancements
            {'title': 'AI-Powered Insights', 'description': 'Machine learning features for predictive planning and risk assessment.', 'priority': 'low', 'status': 'planned', 'release': 'Future Innovation', 'date': (datetime.today() + timedelta(days=150)).date()},
            {'title': 'Advanced Exports', 'description': 'Enhanced export options including PDF, Excel, and presentation formats.', 'priority': 'low', 'status': 'planned', 'release': 'Future Innovation', 'date': (datetime.today() + timedelta(days=180)).date()}
        ]

        for s in samples:
            f = Feature(
                title=s['title'],
                description=s['description'],
                priority=s['priority'],
                status=s['status'],
                release=s['release'],
                date=s['date'],
                roadmap_id=demo_rm.id
            )
            db.session.add(f)
        db.session.commit()

    # Redirect to the demo roadmap
    return redirect(url_for('roadmap', roadmap_id=demo_rm.id))

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/profile')
def profile():
    return render_template('profile.html')

@app.route('/features')
def features():
    return render_template('features.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/personas')
def personas_view():
    return render_template('personas.html')

# Serve firebase-config.js dynamically from environment variables
@app.route('/js/firebase-config.js')
def firebase_config_js():
    config = {
        'apiKey': os.getenv('FIREBASE_API_KEY'),
        'authDomain': os.getenv('FIREBASE_AUTH_DOMAIN'),
        'projectId': os.getenv('FIREBASE_PROJECT_ID'),
        'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET'),
        'messagingSenderId': os.getenv('FIREBASE_MESSAGING_SENDER_ID'),
        'appId': os.getenv('FIREBASE_APP_ID'),
        'measurementId': os.getenv('FIREBASE_MEASUREMENT_ID')
    }
    js = f"""// Your web app's Firebase configuration
const firebaseConfig = {{
    apiKey: "{config['apiKey']}",
    authDomain: "{config['authDomain']}",
    projectId: "{config['projectId']}",
    storageBucket: "{config['storageBucket']}",
    messagingSenderId: "{config['messagingSenderId']}",
    appId: "{config['appId']}",
    measurementId: "{config['measurementId']}"
}};
firebase.initializeApp(firebaseConfig);
"""
    return Response(js, mimetype='application/javascript')

if __name__ == '__main__':
    # Initialize database tables
    with app.app_context():
        init_db()
    
    # Check if running in production
    is_production = os.getenv('FLASK_ENV') == 'production'
    
    if is_production:
        # Production settings
        app.run(
            host='0.0.0.0',
            port=int(os.getenv('PORT', 5000)),
            debug=False
        )
    else:
        # Development settings with HTTPS
        app.run(
            host='127.0.0.1',
            port=5000,
            debug=True,
            ssl_context='adhoc'  # Enable self-signed SSL for development
        ) 