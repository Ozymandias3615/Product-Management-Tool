from flask import Flask, render_template, request, jsonify, redirect, url_for, Response, send_file, make_response, session
from firebase_admin import credentials, initialize_app, auth
import os
import secrets
import hashlib
import json
import csv
import io
import base64
import requests
from dotenv import load_dotenv
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
# Ensure secret key is set properly
secret_key = os.getenv('SECRET_KEY')
if not secret_key:
    if os.getenv('FLASK_ENV') == 'production':
        raise ValueError("SECRET_KEY environment variable must be set in production")
    else:
        secret_key = 'dev-secret-key-change-in-production'
app.secret_key = secret_key

# Security headers
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# Database configuration
database_url = os.getenv('DATABASE_URL', 'sqlite:///roadmap.db')
# Fix for Heroku PostgreSQL URL format
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Mailgun configuration
MAILGUN_API_KEY = os.getenv('MAILGUN_API_KEY')
MAILGUN_DOMAIN = os.getenv('MAILGUN_DOMAIN')
MAILGUN_BASE_URL = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
MAIL_FROM_ADDRESS = os.getenv('MAIL_FROM_ADDRESS', 'noreply@sandbox-123.mailgun.org')
MAIL_FROM_NAME = os.getenv('MAIL_FROM_NAME', 'Product Compass')

# Initialize extensions
db = SQLAlchemy(app)

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000 per hour", "100 per minute"],
    storage_uri="memory://",  # Use Redis in production: "redis://localhost:6379"
)

# Rate limit error handler
@app.errorhandler(429)
def rate_limit_handler(e):
    if request.is_json or request.path.startswith('/api/'):
        return jsonify({
            'error': 'Rate limit exceeded',
            'message': 'Too many requests. Please try again later.',
            'retry_after': getattr(e, 'retry_after', None)
        }), 429
    else:
        return render_template('error.html',
                             error_title="Rate Limit Exceeded",
                             error_message="Too many requests. Please wait a moment and try again."), 429

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=True)  # nullable for Google users
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))  # nullable for Google users
    full_name = db.Column(db.String(100))
    avatar_url = db.Column(db.String(200))
    google_id = db.Column(db.String(100), unique=True)  # Google user ID
    auth_provider = db.Column(db.String(20), default='local')  # local, google
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    owned_roadmaps = db.relationship('Roadmap', backref='owner', lazy=True, foreign_keys='Roadmap.owner_id')
    memberships = db.relationship('ProjectMember', backref='user', lazy=True, cascade='all, delete-orphan', foreign_keys='ProjectMember.user_id')
    invited_members = db.relationship('ProjectMember', backref='inviter', lazy=True, foreign_keys='ProjectMember.invited_by')

# Roadmap model
class Roadmap(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # nullable for existing data
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = db.Column(db.Boolean, default=False)
    
    # Relationships
    features = db.relationship('Feature', backref='roadmap', lazy=True, cascade='all, delete-orphan')
    shared_links = db.relationship('ShareableLink', backref='roadmap', lazy=True, cascade='all, delete-orphan')
    exports = db.relationship('ExportHistory', backref='roadmap', lazy=True, cascade='all, delete-orphan')
    members = db.relationship('ProjectMember', backref='roadmap', lazy=True, cascade='all, delete-orphan')
    team_invitations = db.relationship('TeamInvitation', backref='roadmap', lazy=True, cascade='all, delete-orphan')

# Project member model for multi-user collaboration
class ProjectMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    roadmap_id = db.Column(db.Integer, db.ForeignKey('roadmap.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), default='member')  # owner, admin, member, viewer
    invited_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    invited_at = db.Column(db.DateTime, default=datetime.utcnow)
    joined_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='active')  # pending, active, inactive
    
    # Unique constraint to prevent duplicate memberships
    __table_args__ = (db.UniqueConstraint('roadmap_id', 'user_id', name='unique_project_member'),)

# Team invitation link model
class TeamInvitation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    roadmap_id = db.Column(db.Integer, db.ForeignKey('roadmap.id'), nullable=False)
    invitation_token = db.Column(db.String(64), unique=True, nullable=False)
    role = db.Column(db.String(20), default='member')  # role to assign when joining
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    max_uses = db.Column(db.Integer)  # null = unlimited
    current_uses = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    creator = db.relationship('User', foreign_keys=[created_by])

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

# Shareable link model
class ShareableLink(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    roadmap_id = db.Column(db.Integer, db.ForeignKey('roadmap.id'), nullable=False)
    share_token = db.Column(db.String(64), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    access_level = db.Column(db.String(20), default='view')  # view, comment, edit
    password_protected = db.Column(db.Boolean, default=False)
    password_hash = db.Column(db.String(128))
    expires_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    allow_embed = db.Column(db.Boolean, default=True)
    custom_branding = db.Column(db.Text)  # JSON for branding options
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100))
    
# Link analytics model
class LinkAnalytics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    link_id = db.Column(db.Integer, db.ForeignKey('shareable_link.id'), nullable=False)
    visitor_ip = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    referer = db.Column(db.Text)
    country = db.Column(db.String(100))
    city = db.Column(db.String(100))
    view_duration = db.Column(db.Integer)  # in seconds
    actions_taken = db.Column(db.Text)  # JSON array of actions
    visited_at = db.Column(db.DateTime, default=datetime.utcnow)

# Export history model
class ExportHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    roadmap_id = db.Column(db.Integer, db.ForeignKey('roadmap.id'), nullable=False)
    export_type = db.Column(db.String(20), nullable=False)  # pdf, png, csv
    export_format = db.Column(db.String(50))  # timeline, kanban, gantt
    file_path = db.Column(db.String(500))
    file_size = db.Column(db.Integer)
    download_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100))

class UserActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action_type = db.Column(db.String(50), nullable=False)  # created, updated, deleted, joined, invited, etc.
    target_type = db.Column(db.String(50), nullable=False)  # roadmap, feature, team, etc.
    target_id = db.Column(db.Integer)  # ID of the target object
    target_name = db.Column(db.String(200))  # Name/title of the target for display
    description = db.Column(db.Text)  # Human-readable description
    extra_data = db.Column(db.Text)  # JSON for additional data
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='activities')

# ============ AUTHENTICATION & AUTHORIZATION ============

# Get current user from session
def get_current_user():
    user_id = session.get('user_id')
    if user_id:
        return User.query.get(user_id)
    return None

# Check if user has access to roadmap
def check_roadmap_access(user_id, roadmap_id, required_permission='view'):
    """
    Check if user has access to roadmap
    required_permission: 'view', 'edit', 'admin', 'owner'
    """
    if not user_id:
        return False
    
    roadmap = Roadmap.query.get(roadmap_id)
    if not roadmap:
        return False
    
    # Check if roadmap is public
    if roadmap.is_public and required_permission == 'view':
        return True
    
    # Check if user is owner
    if roadmap.owner_id == user_id:
        return True
    
    # Check if user is a member
    member = ProjectMember.query.filter_by(
        roadmap_id=roadmap_id, 
        user_id=user_id, 
        status='active'
    ).first()
    
    if not member:
        return False
    
    # Permission hierarchy: owner > admin > member > viewer
    role_permissions = {
        'owner': ['view', 'edit', 'admin', 'owner'],
        'admin': ['view', 'edit', 'admin'],
        'member': ['view', 'edit'],
        'viewer': ['view']
    }
    
    user_permissions = role_permissions.get(member.role, [])
    return required_permission in user_permissions

# Decorator to require authentication
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            # Check if this is an API request (JSON or API path)
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Decorator to require roadmap access
def roadmap_access_required(permission='view'):
    def decorator(f):
        @wraps(f)
        def decorated_function(roadmap_id, *args, **kwargs):
            user = get_current_user()
            if not user:
                # Check if this is an API request (JSON or API path)
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'Authentication required'}), 401
                return redirect(url_for('login'))
            
            if not check_roadmap_access(user.id, roadmap_id, permission):
                # Check if this is an API request (JSON or API path)
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'Access denied'}), 403
                return render_template('error.html', 
                                     error_title="Access Denied", 
                                     error_message="You don't have permission to access this roadmap."), 403
            
            return f(roadmap_id, *args, **kwargs)
        return decorated_function
    return decorator

# Decorator to require feature access (checks roadmap access through feature)
def feature_access_required(permission='view'):
    def decorator(f):
        @wraps(f)
        def decorated_function(feature_id, *args, **kwargs):
            user = get_current_user()
            if not user:
                # Check if this is an API request (JSON or API path)
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'Authentication required'}), 401
                return redirect(url_for('login'))
            
            feature = Feature.query.get_or_404(feature_id)
            
            if not check_roadmap_access(user.id, feature.roadmap_id, permission):
                # Check if this is an API request (JSON or API path)
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'Access denied'}), 403
                return render_template('error.html', 
                                     error_title="Access Denied", 
                                     error_message="You don't have permission to access this feature."), 403
            
            return f(feature_id, *args, **kwargs)
        return decorated_function
    return decorator

# Create database tables on startup
def init_db():
    # Create tables if they don't exist (preserves existing data)
    with app.app_context():
        db.create_all()

# Helper function to send emails via Mailgun
def send_mailgun_email(to_email, subject, html_content, text_content=None, reply_to=None):
    """Send email using Mailgun API with enhanced deliverability"""
    try:
        if not MAILGUN_API_KEY or not MAILGUN_DOMAIN:
            raise Exception("Mailgun API key or domain not configured")
        
        url = f"{MAILGUN_BASE_URL}/{MAILGUN_DOMAIN}/messages"
        
        # Enhanced data with anti-spam headers
        data = {
            'from': f"{MAIL_FROM_NAME} <{MAIL_FROM_ADDRESS}>",
            'to': to_email,
            'subject': subject,
            'html': html_content,
            # Anti-spam headers
            'h:X-Mailgun-Tag': 'contact-form',
            'h:X-Mailgun-Track': 'yes',
            'h:X-Mailgun-Track-Opens': 'yes',
            'h:List-Unsubscribe': f'<mailto:unsubscribe@{MAILGUN_DOMAIN.split(".", 1)[-1] if "." in MAILGUN_DOMAIN else MAILGUN_DOMAIN}>',
            'h:X-Priority': '3',
            'h:X-MSMail-Priority': 'Normal',
            'h:Importance': 'Normal'
        }
        
        # Add text version if provided
        if text_content:
            data['text'] = text_content
        else:
            # Generate basic text version from HTML
            import re
            text_version = re.sub('<[^<]+?>', '', html_content)
            text_version = re.sub(r'\s+', ' ', text_version).strip()
            data['text'] = text_version
        
        # Add reply-to if provided
        if reply_to:
            data['h:Reply-To'] = reply_to
        
        response = requests.post(
            url,
            auth=('api', MAILGUN_API_KEY),
            data=data,
            timeout=10
        )
        
        if response.status_code == 200:
            return True, "Email sent successfully"
        else:
            return False, f"Mailgun API error: {response.status_code} - {response.text}"
            
    except Exception as e:
        return False, f"Email sending failed: {str(e)}"

# Helper function to track link visits
def track_link_visit(link_id, request):
    try:
        # Get visitor info
        visitor_ip = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')
        referer = request.headers.get('Referer', '')
        
        # Create analytics record
        analytics = LinkAnalytics(
            link_id=link_id,
            visitor_ip=visitor_ip,
            user_agent=user_agent,
            referer=referer,
            country='Unknown',  # Could integrate with IP geolocation service
            city='Unknown'
        )
        
        db.session.add(analytics)
        db.session.commit()
    except Exception as e:
        # Don't let analytics tracking break the main functionality
        print(f"Analytics tracking error: {e}")

# Helper function to log user activities
def log_user_activity(user_id, action_type, target_type, target_id=None, target_name=None, description=None, metadata=None):
    """Log user activity for tracking"""
    try:
        activity = UserActivity(
            user_id=user_id,
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            target_name=target_name,
            description=description,
            extra_data=json.dumps(metadata) if metadata else None
        )
        db.session.add(activity)
        db.session.commit()
    except Exception as e:
        print(f"Error logging user activity: {e}")
        db.session.rollback()

def create_template_features(roadmap_id, template, user_id):
    """Create initial features based on template selection"""
    template_features = {
        'product': [
            {'title': 'Market Research', 'description': 'Conduct market analysis and competitor research', 'priority': 'High', 'status': 'Planned', 'days_offset': 0},
            {'title': 'MVP Development', 'description': 'Build minimum viable product', 'priority': 'High', 'status': 'Planned', 'days_offset': 30},
            {'title': 'Beta Testing', 'description': 'Conduct beta testing with select users', 'priority': 'Medium', 'status': 'Planned', 'days_offset': 90},
            {'title': 'Product Launch', 'description': 'Official product launch and marketing campaign', 'priority': 'High', 'status': 'Planned', 'days_offset': 120}
        ],
        'feature': [
            {'title': 'Requirements Gathering', 'description': 'Define feature requirements and specifications', 'priority': 'High', 'status': 'Planned', 'days_offset': 0},
            {'title': 'Design & Prototyping', 'description': 'Create wireframes and interactive prototypes', 'priority': 'High', 'status': 'Planned', 'days_offset': 14},
            {'title': 'Development', 'description': 'Implement the feature functionality', 'priority': 'High', 'status': 'Planned', 'days_offset': 28},
            {'title': 'Testing & QA', 'description': 'Comprehensive testing and quality assurance', 'priority': 'Medium', 'status': 'Planned', 'days_offset': 56},
            {'title': 'Deployment', 'description': 'Deploy feature to production environment', 'priority': 'High', 'status': 'Planned', 'days_offset': 70}
        ],
        'sprint': [
            {'title': 'Sprint Planning', 'description': 'Plan sprint goals and user stories', 'priority': 'High', 'status': 'In Progress', 'days_offset': 0},
            {'title': 'Development Phase', 'description': 'Active development of sprint items', 'priority': 'High', 'status': 'Planned', 'days_offset': 1},
            {'title': 'Code Review', 'description': 'Peer review of developed code', 'priority': 'High', 'status': 'Planned', 'days_offset': 10},
            {'title': 'Testing', 'description': 'Test developed features and fixes', 'priority': 'Medium', 'status': 'Planned', 'days_offset': 12},
            {'title': 'Sprint Review', 'description': 'Review sprint outcomes and demo', 'priority': 'Medium', 'status': 'Planned', 'days_offset': 14}
        ]
    }
    
    if template in template_features:
        base_date = datetime.utcnow().date()
        for feature_data in template_features[template]:
            feature = Feature(
                title=feature_data['title'],
                description=feature_data['description'],
                priority=feature_data['priority'],
                status=feature_data['status'],
                date=base_date + timedelta(days=feature_data['days_offset']),
                roadmap_id=roadmap_id
            )
            db.session.add(feature)
        db.session.commit()

# API to create a new roadmap
@app.route('/api/roadmaps', methods=['POST'])
@login_required
def add_roadmap():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    
    user = get_current_user()
    
    # Handle visibility setting
    visibility = data.get('visibility', 'private')
    is_public = visibility == 'public'
    
    rm = Roadmap(
        name=name,
        description=data.get('description', ''),
        owner_id=user.id,
        is_public=is_public
    )
    db.session.add(rm)
    db.session.commit()
    
    # Handle template-based initialization
    template = data.get('template', 'blank')
    if template != 'blank':
        create_template_features(rm.id, template, user.id)
    
    # Log activity
    log_user_activity(
        user_id=user.id,
        action_type='created',
        target_type='roadmap',
        target_id=rm.id,
        target_name=rm.name,
        description=f"Created roadmap '{rm.name}' using {template} template"
    )
    
    return jsonify({
        'id': rm.id, 
        'name': rm.name,
        'description': rm.description,
        'is_owner': True,
        'template': template,
        'visibility': visibility
    }), 201

# API to get features by roadmap
@app.route('/api/roadmaps/<int:roadmap_id>/features', methods=['GET'])
@roadmap_access_required('view')
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
@roadmap_access_required('edit')
def add_feature_to_roadmap(roadmap_id):
    data = request.json
    try:
        roadmap = Roadmap.query.get_or_404(roadmap_id)
        user = get_current_user()
        
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
        
        # Log activity
        log_user_activity(
            user_id=user.id,
            action_type='created',
            target_type='feature',
            target_id=feature.id,
            target_name=feature.title,
            description=f"Added feature '{feature.title}' to roadmap '{roadmap.name}'",
            metadata={'roadmap_id': roadmap_id, 'roadmap_name': roadmap.name}
        )
        
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
@feature_access_required('edit')
def update_feature(feature_id):
    data = request.json
    feature = Feature.query.get(feature_id)
    if not feature:
        return jsonify({'error': 'Feature not found'}), 404
    try:
        user = get_current_user()
        roadmap = Roadmap.query.get(feature.roadmap_id)
        
        # Track what changed
        changes = []
        if data.get('title') and data.get('title') != feature.title:
            changes.append(f"title: '{feature.title}' → '{data.get('title')}'")
        if data.get('status') and data.get('status') != feature.status:
            changes.append(f"status: '{feature.status}' → '{data.get('status')}'")
        if data.get('priority') and data.get('priority') != feature.priority:
            changes.append(f"priority: '{feature.priority}' → '{data.get('priority')}'")
        
        feature.title = data.get('title', feature.title)
        feature.description = data.get('description', feature.description)
        feature.priority = data.get('priority', feature.priority)
        feature.status = data.get('status', feature.status)
        feature.release = data.get('release', feature.release)
        feature.date = datetime.fromisoformat(data.get('date')).date()
        db.session.commit()
        
        # Log activity
        if changes:
            change_description = ', '.join(changes)
            log_user_activity(
                user_id=user.id,
                action_type='updated',
                target_type='feature',
                target_id=feature.id,
                target_name=feature.title,
                description=f"Updated feature '{feature.title}' in roadmap '{roadmap.name}' ({change_description})",
                metadata={'roadmap_id': feature.roadmap_id, 'roadmap_name': roadmap.name, 'changes': changes}
            )
        
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
@feature_access_required('edit')
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

# ============ SHARING & EXPORT APIs ============

# Create shareable link
@app.route('/api/roadmaps/<int:roadmap_id>/share', methods=['POST'])
def create_shareable_link(roadmap_id):
    data = request.json
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    
    # Generate unique share token
    share_token = secrets.token_urlsafe(32)
    
    # Create shareable link
    link = ShareableLink(
        roadmap_id=roadmap_id,
        share_token=share_token,
        title=data.get('title', f"{roadmap.name} - Shared Roadmap"),
        description=data.get('description', ''),
        access_level=data.get('access_level', 'view'),
        password_protected=data.get('password_protected', False),
        expires_at=datetime.fromisoformat(data.get('expires_at')) if data.get('expires_at') else None,
        allow_embed=data.get('allow_embed', True),
        custom_branding=json.dumps(data.get('custom_branding', {})),
        created_by=data.get('created_by', 'anonymous')
    )
    
    if data.get('password'):
        link.password_hash = generate_password_hash(data.get('password'))
    
    db.session.add(link)
    db.session.commit()
    
    return jsonify({
        'id': link.id,
        'share_token': link.share_token,
        'share_url': f"{request.host_url}share/{link.share_token}",
        'embed_url': f"{request.host_url}embed/{link.share_token}",
        'title': link.title,
        'access_level': link.access_level,
        'expires_at': link.expires_at.isoformat() if link.expires_at else None,
        'allow_embed': link.allow_embed
    }), 201

# Get shareable links for a roadmap
@app.route('/api/roadmaps/<int:roadmap_id>/shares', methods=['GET'])
def get_shareable_links(roadmap_id):
    links = ShareableLink.query.filter_by(roadmap_id=roadmap_id, is_active=True).all()
    result = []
    for link in links:
        result.append({
            'id': link.id,
            'share_token': link.share_token,
            'share_url': f"{request.host_url}share/{link.share_token}",
            'embed_url': f"{request.host_url}embed/{link.share_token}",
            'title': link.title,
            'description': link.description,
            'access_level': link.access_level,
            'password_protected': link.password_protected,
            'expires_at': link.expires_at.isoformat() if link.expires_at else None,
            'allow_embed': link.allow_embed,
            'created_at': link.created_at.isoformat(),
            'view_count': LinkAnalytics.query.filter_by(link_id=link.id).count()
        })
    return jsonify(result), 200

# Update shareable link
@app.route('/api/shares/<int:link_id>', methods=['PUT'])
def update_shareable_link(link_id):
    data = request.json
    link = ShareableLink.query.get_or_404(link_id)
    
    link.title = data.get('title', link.title)
    link.description = data.get('description', link.description)
    link.access_level = data.get('access_level', link.access_level)
    link.password_protected = data.get('password_protected', link.password_protected)
    link.allow_embed = data.get('allow_embed', link.allow_embed)
    link.is_active = data.get('is_active', link.is_active)
    
    if data.get('expires_at'):
        link.expires_at = datetime.fromisoformat(data.get('expires_at'))
    
    if data.get('password'):
        link.password_hash = generate_password_hash(data.get('password'))
    elif data.get('password') == '':
        link.password_hash = None
        link.password_protected = False
    
    if data.get('custom_branding'):
        link.custom_branding = json.dumps(data.get('custom_branding'))
    
    db.session.commit()
    return jsonify({'message': 'Link updated successfully'}), 200

# Delete shareable link
@app.route('/api/shares/<int:link_id>', methods=['DELETE'])
def delete_shareable_link(link_id):
    link = ShareableLink.query.get_or_404(link_id)
    link.is_active = False
    db.session.commit()
    return jsonify({'message': 'Link deactivated successfully'}), 200

# Export roadmap as CSV
@app.route('/api/roadmaps/<int:roadmap_id>/export/csv', methods=['GET'])
def export_roadmap_csv(roadmap_id):
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    features = Feature.query.filter_by(roadmap_id=roadmap_id).order_by(Feature.date).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['Title', 'Description', 'Priority', 'Status', 'Release', 'Date'])
    
    # Write features
    for feature in features:
        writer.writerow([
            feature.title,
            feature.description,
            feature.priority,
            feature.status,
            feature.release,
            feature.date.isoformat()
        ])
    
    # Create export record
    export_record = ExportHistory(
        roadmap_id=roadmap_id,
        export_type='csv',
        export_format='table',
        created_by=request.args.get('user', 'anonymous')
    )
    db.session.add(export_record)
    db.session.commit()
    
    output.seek(0)
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename="{roadmap.name}_roadmap.csv"'
    
    return response



# Get export history
@app.route('/api/roadmaps/<int:roadmap_id>/exports', methods=['GET'])
def get_export_history(roadmap_id):
    exports = ExportHistory.query.filter_by(roadmap_id=roadmap_id).order_by(ExportHistory.created_at.desc()).all()
    result = []
    for export in exports:
        result.append({
            'id': export.id,
            'export_type': export.export_type,
            'export_format': export.export_format,
            'file_size': export.file_size,
            'download_count': export.download_count,
            'created_at': export.created_at.isoformat(),
            'created_by': export.created_by
        })
    return jsonify(result), 200

# Get link analytics
@app.route('/api/shares/<int:link_id>/analytics', methods=['GET'])
def get_link_analytics(link_id):
    link = ShareableLink.query.get_or_404(link_id)
    analytics = LinkAnalytics.query.filter_by(link_id=link_id).order_by(LinkAnalytics.visited_at.desc()).all()
    
    # Aggregate data
    total_views = len(analytics)
    unique_visitors = len(set(a.visitor_ip for a in analytics if a.visitor_ip))
    countries = {}
    daily_views = {}
    
    for analytic in analytics:
        # Country stats
        country = analytic.country or 'Unknown'
        countries[country] = countries.get(country, 0) + 1
        
        # Daily views
        date_key = analytic.visited_at.date().isoformat()
        daily_views[date_key] = daily_views.get(date_key, 0) + 1
    
    return jsonify({
        'link_id': link_id,
        'total_views': total_views,
        'unique_visitors': unique_visitors,
        'countries': countries,
        'daily_views': daily_views,
        'recent_visits': [{
            'visited_at': a.visited_at.isoformat(),
            'country': a.country,
            'city': a.city,
            'referer': a.referer,
            'view_duration': a.view_duration
        } for a in analytics[:50]]  # Last 50 visits
    }), 200

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

# User Management APIs

# API to register a new user
@app.route('/api/users/register', methods=['POST'])
@limiter.limit("3 per minute")  # Prevent spam registrations
def register_user():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name', '')
    
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400
    
    # Check if user already exists
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'User already exists'}), 409
    
    # Create new user
    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        full_name=full_name
    )
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.full_name,
        'created_at': user.created_at.isoformat()
    }), 201

# API to authenticate user
@app.route('/api/users/login', methods=['POST'])
@limiter.limit("5 per minute")  # Prevent brute force attacks
def login_user():
    data = request.json
    username_or_email = data.get('username')
    password = data.get('password')
    google_user = data.get('google_user')
    
    if google_user:
        # Handle Google login
        email = google_user.get('email')
        google_id = google_user.get('google_id')
        full_name = google_user.get('full_name')
        avatar_url = google_user.get('avatar_url')
        
        # Normalize avatar URL - treat empty strings as None
        if avatar_url and avatar_url.strip() == '':
            avatar_url = None
        
        if not email or not google_id:
            return jsonify({'error': 'Google email and ID are required'}), 400
        
        # Find or create Google user
        user = User.query.filter(
            (User.email == email) | (User.google_id == google_id)
        ).first()
        
        if user:
            # Update existing user with Google info
            if not user.google_id:
                user.google_id = google_id
                user.auth_provider = 'google'
            if not user.full_name and full_name:
                user.full_name = full_name
            # Update avatar only if we have a valid URL and user doesn't have one
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            user.last_login = datetime.utcnow()
            db.session.commit()
        else:
            # Create new Google user
            username_base = email.split('@')[0]
            username = username_base
            counter = 1
            while User.query.filter_by(username=username).first():
                username = f"{username_base}{counter}"
                counter += 1
            
            user = User(
                username=username,
                email=email,
                full_name=full_name or email.split('@')[0],
                google_id=google_id,
                auth_provider='google',
                avatar_url=avatar_url,  # This will be None if no valid avatar
                last_login=datetime.utcnow()
            )
            
            db.session.add(user)
            db.session.commit()
    else:
        # Handle traditional login
        if not username_or_email or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400
        
        # Find user by username or email
        user = User.query.filter(
            (User.username == username_or_email) | (User.email == username_or_email)
        ).first()
        
        if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
    
    # Create session for authenticated user
    session['user_id'] = user.id
    session['user_email'] = user.email
    session.permanent = True
    
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.full_name,
        'avatar_url': user.avatar_url,
        'auth_provider': user.auth_provider
    }), 200

# API to logout user
@app.route('/api/users/logout', methods=['POST'])
def logout_user():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

# API to get current user info
@app.route('/api/users/me', methods=['GET'])
@login_required
def get_current_user_info():
    user = get_current_user()
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.full_name,
        'avatar_url': user.avatar_url,
        'auth_provider': user.auth_provider,
        'created_at': user.created_at.isoformat() if user.created_at else None,
        'last_login': user.last_login.isoformat() if user.last_login else None
    }), 200

@app.route('/api/users/me', methods=['PUT'])
@login_required
def update_current_user_info():
    user = get_current_user()
    data = request.json
    
    # Update allowed fields
    if 'full_name' in data:
        user.full_name = data['full_name'].strip()
    
    if 'username' in data:
        new_username = data['username'].strip()
        if new_username != user.username:
            # Check if username is already taken
            existing_user = User.query.filter_by(username=new_username).first()
            if existing_user and existing_user.id != user.id:
                return jsonify({'error': 'Username is already taken'}), 409
            user.username = new_username
    
    try:
        db.session.commit()
        
        # Log profile update activity
        log_user_activity(
            user_id=user.id,
            action_type='updated',
            target_type='profile',
            target_id=user.id,
            target_name='Profile',
            description="Updated profile information"
        )
        
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_url': user.avatar_url,
            'auth_provider': user.auth_provider
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile'}), 500

@app.route('/api/users/me/activity', methods=['GET'])
@login_required
def get_user_activity():
    user = get_current_user()
    limit = request.args.get('limit', 10, type=int)
    
    activities = UserActivity.query.filter_by(user_id=user.id)\
        .order_by(UserActivity.created_at.desc())\
        .limit(limit).all()
    
    result = []
    for activity in activities:
        # Parse extra_data if exists
        metadata = {}
        if activity.extra_data:
            try:
                metadata = json.loads(activity.extra_data)
            except:
                pass
        
        # Determine icon and color based on action type
        icon_map = {
            'created': {'icon': 'bi-plus-circle', 'color': 'success'},
            'updated': {'icon': 'bi-pencil', 'color': 'primary'},
            'deleted': {'icon': 'bi-trash', 'color': 'danger'},
            'joined': {'icon': 'bi-people', 'color': 'info'},
            'invited': {'icon': 'bi-person-plus', 'color': 'warning'},
            'exported': {'icon': 'bi-download', 'color': 'secondary'}
        }
        
        icon_info = icon_map.get(activity.action_type, {'icon': 'bi-circle', 'color': 'secondary'})
        
        # Calculate time ago
        time_diff = datetime.utcnow() - activity.created_at
        if time_diff.days > 0:
            time_ago = f"{time_diff.days} day{'s' if time_diff.days > 1 else ''} ago"
        elif time_diff.seconds > 3600:
            hours = time_diff.seconds // 3600
            time_ago = f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif time_diff.seconds > 60:
            minutes = time_diff.seconds // 60
            time_ago = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        else:
            time_ago = "Just now"
        
        result.append({
            'id': activity.id,
            'action_type': activity.action_type,
            'target_type': activity.target_type,
            'target_name': activity.target_name,
            'description': activity.description,
            'created_at': activity.created_at.isoformat(),
            'time_ago': time_ago,
            'icon': icon_info['icon'],
            'color': icon_info['color'],
            'metadata': metadata
        })
    
    return jsonify(result), 200

# API to get recent notifications for the current user
@app.route('/api/users/me/notifications', methods=['GET'])
@login_required
def get_user_notifications():
    user = get_current_user()
    limit = min(request.args.get('limit', 10, type=int), 50)  # Max 50 notifications
    
    # Get recent activities related to the user (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Get activities where user was invited, added to roadmaps, or relevant changes happened
    user_roadmap_ids = [m.roadmap_id for m in user.memberships if m.status == 'active']
    
    activities = UserActivity.query.filter(
        db.or_(
            # Activities about the user (being invited, added to teams, etc.)
            db.and_(
                UserActivity.action_type.in_(['invited', 'joined']),
                UserActivity.user_id == user.id
            ),
            # Activities on roadmaps the user is a member of (but not their own actions)
            db.and_(
                UserActivity.action_type.in_(['created', 'updated', 'deleted']),
                UserActivity.target_type.in_(['roadmap', 'feature']),
                UserActivity.user_id != user.id,  # Not their own actions
                UserActivity.target_id.in_(user_roadmap_ids) if user_roadmap_ids else False
            )
        ),
        UserActivity.created_at >= seven_days_ago
    ).order_by(UserActivity.created_at.desc()).limit(limit).all()
    
    notifications = []
    for activity in activities:
        # Determine notification type and icon
        if activity.action_type == 'invited':
            icon = 'bi-person-plus'
            type_class = 'notification-invite'
        elif activity.action_type == 'joined':
            icon = 'bi-person-check'
            type_class = 'notification-join'
        elif activity.action_type == 'created' and activity.target_type == 'roadmap':
            icon = 'bi-plus-circle'
            type_class = 'notification-create'
        elif activity.action_type == 'created' and activity.target_type == 'feature':
            icon = 'bi-plus-square'
            type_class = 'notification-feature'
        elif activity.action_type == 'updated':
            icon = 'bi-pencil-square'
            type_class = 'notification-update'
        elif activity.action_type == 'deleted':
            icon = 'bi-trash'
            type_class = 'notification-delete'
        else:
            icon = 'bi-bell'
            type_class = 'notification-general'
        
        # Generate notification URL
        notification_url = None
        if activity.target_type == 'roadmap' and activity.target_id:
            notification_url = f"/roadmap/{activity.target_id}"
        elif activity.target_type == 'feature' and activity.target_id:
            # Get the roadmap ID for the feature
            feature = Feature.query.get(activity.target_id)
            if feature:
                notification_url = f"/roadmap/{feature.roadmap_id}"
        
        # Calculate time ago
        time_diff = datetime.utcnow() - activity.created_at
        if time_diff.days > 0:
            time_ago = f"{time_diff.days}d ago"
        elif time_diff.seconds > 3600:
            time_ago = f"{time_diff.seconds // 3600}h ago"
        elif time_diff.seconds > 60:
            time_ago = f"{time_diff.seconds // 60}m ago"
        else:
            time_ago = "Just now"
        
        # Check if notification is unread based on last viewed timestamp
        last_viewed_str = session.get('notifications_last_viewed')
        is_unread = True
        if last_viewed_str:
            try:
                last_viewed = datetime.fromisoformat(last_viewed_str)
                is_unread = activity.created_at > last_viewed
            except:
                # If parsing fails, consider it unread
                is_unread = True
        
        notifications.append({
            'id': activity.id,
            'title': activity.target_name or 'Unknown',
            'description': activity.description,
            'icon': icon,
            'type_class': type_class,
            'time_ago': time_ago,
            'created_at': activity.created_at.isoformat(),
            'url': notification_url,
            'is_new': is_unread and time_diff.total_seconds() < 86400  # New if unread and less than 24 hours
        })
    
    return jsonify({
        'notifications': notifications,
        'count': len(notifications),
        'unread_count': sum(1 for n in notifications if n['is_new'])
    }), 200

# API to mark notifications as viewed (reset unread count)
@app.route('/api/users/me/notifications/mark-viewed', methods=['POST'])
@login_required
def mark_notifications_viewed():
    user = get_current_user()
    
    # Store the last viewed timestamp in user session or database
    # For simplicity, we'll use session storage
    session['notifications_last_viewed'] = datetime.utcnow().isoformat()
    
    return jsonify({'success': True}), 200

# API to search users by username or email
@app.route('/api/users/search', methods=['GET'])
def search_users():
    query = request.args.get('q', '').strip()
    
    if len(query) < 2:
        return jsonify({'error': 'Query must be at least 2 characters'}), 400
    
    users = User.query.filter(
        (User.username.contains(query)) | 
        (User.email.contains(query)) |
        (User.full_name.contains(query))
    ).filter(User.is_active == True).limit(10).all()
    
    return jsonify([{
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.full_name,
        'avatar_url': user.avatar_url
    } for user in users]), 200

# Project Member Management APIs

# API to invite user to roadmap
@app.route('/api/roadmaps/<int:roadmap_id>/members', methods=['POST'])
@roadmap_access_required('admin')
def invite_user_to_roadmap(roadmap_id):
    data = request.json
    user_id = data.get('user_id')
    role = data.get('role', 'member')
    invited_by = get_current_user().id
    
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    user = User.query.get_or_404(user_id)
    
    # Check if user is already a member
    existing_member = ProjectMember.query.filter_by(roadmap_id=roadmap_id, user_id=user_id).first()
    if existing_member:
        return jsonify({'error': 'User is already a member of this project'}), 409
    
    # Create membership
    member = ProjectMember(
        roadmap_id=roadmap_id,
        user_id=user_id,
        role=role,
        invited_by=invited_by,
        joined_at=datetime.utcnow()  # Auto-join for now, could be pending
    )
    
    db.session.add(member)
    db.session.commit()
    
    # Log activity for inviter
    inviter = get_current_user()
    log_user_activity(
        user_id=inviter.id,
        action_type='invited',
        target_type='user',
        target_id=user.id,
        target_name=user.full_name or user.username,
        description=f"Invited {user.full_name or user.username} to join roadmap '{roadmap.name}' as {role}",
        metadata={'roadmap_id': roadmap_id, 'roadmap_name': roadmap.name, 'role': role}
    )
    
    # Log activity for invitee
    log_user_activity(
        user_id=user.id,
        action_type='joined',
        target_type='roadmap',
        target_id=roadmap_id,
        target_name=roadmap.name,
        description=f"Joined roadmap '{roadmap.name}' as {role}",
        metadata={'role': role, 'invited_by': inviter.full_name or inviter.username}
    )
    
    # Send email notification to the invited user
    try:
        # Fix URL generation for local development
        if 'localhost' in request.host_url or '127.0.0.1' in request.host_url:
            roadmap_url = f"http://localhost:5000/roadmap/{roadmap_id}"
        else:
            roadmap_url = f"{request.host_url}roadmap/{roadmap_id}"
            
        inviter_name = inviter.full_name or inviter.username
        user_name = user.full_name or user.username
        
        # Create email subject
        subject = f"You've been added to '{roadmap.name}' roadmap"
        
        # Create HTML email content
        html_content = f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0056d2, #4f46e5); color: white; padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 600;">
                    🎯 You're invited to collaborate!
                </h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">
                    {inviter_name} has added you to a product roadmap
                </p>
            </div>
            
            <!-- Main Content -->
            <div style="padding: 2rem; background: #f8f9fa; border-radius: 0 0 8px 8px;">
                <div style="background: white; padding: 1.5rem; border-radius: 6px; margin-bottom: 1.5rem; border-left: 4px solid #0056d2;">
                    <h2 style="color: #0056d2; margin: 0 0 1rem 0; font-size: 24px;">
                        📋 {roadmap.name}
                    </h2>
                    {f'<p style="color: #666; margin: 0 0 1rem 0; line-height: 1.6;">{roadmap.description}</p>' if roadmap.description else ''}
                    
                    <div style="display: flex; align-items: center; gap: 1rem; margin: 1rem 0;">
                        <div style="background: #e3f2fd; padding: 0.5rem 1rem; border-radius: 20px; font-size: 14px; font-weight: 600; color: #1976d2;">
                            👤 Role: {role.title()}
                        </div>
                        <div style="background: #e8f5e8; padding: 0.5rem 1rem; border-radius: 20px; font-size: 14px; font-weight: 600; color: #2e7d32;">
                            📅 Added: {datetime.utcnow().strftime('%B %d, %Y')}
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 1.5rem 0;">
                    <p style="color: #333; margin: 0 0 1rem 0; font-size: 16px;">
                        Hi {user_name}! 👋<br>
                        You now have access to collaborate on this roadmap as a <strong>{role}</strong>.
                    </p>
                    
                    <a href="{roadmap_url}" style="display: inline-block; background: #0056d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 1rem 0;">
                        🚀 View Roadmap
                    </a>
                </div>
                
                <!-- Permissions Info -->
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 1rem; border-radius: 6px; margin: 1rem 0;">
                    <h3 style="color: #856404; margin: 0 0 0.5rem 0; font-size: 16px;">
                        🔐 Your Access Level: {role.title()}
                    </h3>
                    <p style="color: #856404; margin: 0; font-size: 14px; line-height: 1.4;">
                        {'You can view, edit, and manage all aspects of this roadmap.' if role == 'admin' 
                         else 'You can view and edit features on this roadmap.' if role == 'member'
                         else 'You can view this roadmap but cannot make changes.' if role == 'viewer'
                         else 'You have full control over this roadmap.'}
                    </p>
                </div>
                
                <!-- Tips -->
                <div style="background: white; padding: 1rem; border-radius: 6px; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; margin: 0 0 0.5rem 0; font-size: 16px;">
                        💡 Getting Started Tips
                    </h3>
                    <ul style="color: #155724; margin: 0; padding-left: 1.2rem; font-size: 14px; line-height: 1.6;">
                        <li>Click the link above to access the roadmap</li>
                        <li>Explore existing features and their priorities</li>
                        <li>Add new features or update existing ones</li>
                        <li>Use the timeline view to see the roadmap progression</li>
                    </ul>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #ddd;">
                    <p style="color: #666; margin: 0; font-size: 14px;">
                        Invited by <strong>{inviter_name}</strong> via Product Compass<br>
                        <a href="{request.host_url}" style="color: #0056d2; text-decoration: none;">Product Compass</a> - Build better products together
                    </p>
                </div>
            </div>
        </div>
        """
        
        # Send the email
        success, error = send_mailgun_email(
            to_email=user.email,
            subject=subject,
            html_content=html_content,
            reply_to=inviter.email if inviter.email else None
        )
        
        if success:
            print(f"✅ Invitation email sent to {user.email}")
        else:
            print(f"⚠️  Failed to send invitation email to {user.email}: {error}")
            # Don't fail the request if email sending fails
            
    except Exception as e:
        print(f"⚠️  Error sending invitation email: {str(e)}")
        # Don't fail the request if email sending fails
    
    return jsonify({
        'id': member.id,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_url': user.avatar_url
        },
        'role': member.role,
        'status': member.status,
        'joined_at': member.joined_at.isoformat()
    }), 201

# API to get roadmap members
@app.route('/api/roadmaps/<int:roadmap_id>/members', methods=['GET'])
@roadmap_access_required('view')
def get_roadmap_members(roadmap_id):
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    
    # Get regular members from ProjectMember table
    members = db.session.query(ProjectMember, User).join(
        User, ProjectMember.user_id == User.id
    ).filter(ProjectMember.roadmap_id == roadmap_id).all()
    
    result = []
    owner_included = False
    
    # Add regular members
    for member, user in members:
        # Check if this member is also the owner
        if roadmap.owner_id and user.id == roadmap.owner_id:
            owner_included = True
        
        result.append({
            'id': member.id,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'avatar_url': user.avatar_url
            },
            'role': member.role,
            'status': member.status,
            'invited_at': member.invited_at.isoformat(),
            'joined_at': member.joined_at.isoformat() if member.joined_at else None
        })
    
    # Add roadmap owner if not already included as a member
    if roadmap.owner_id and not owner_included:
        owner = User.query.get(roadmap.owner_id)
        if owner:
            result.append({
                'id': f'owner_{roadmap.owner_id}',  # Special ID for owner
                'user': {
                    'id': owner.id,
                    'username': owner.username,
                    'email': owner.email,
                    'full_name': owner.full_name,
                    'avatar_url': owner.avatar_url
                },
                'role': 'owner',
                'status': 'active',
                'invited_at': roadmap.created_at.isoformat(),
                'joined_at': roadmap.created_at.isoformat()
            })
    
    return jsonify(result), 200

# API to update member role
@app.route('/api/roadmaps/<int:roadmap_id>/members/<member_id>', methods=['PUT'])
@roadmap_access_required('admin')
def update_member_role(roadmap_id, member_id):
    data = request.json
    new_role = data.get('role')
    
    if not new_role or new_role not in ['owner', 'admin', 'member', 'viewer']:
        return jsonify({'error': 'Valid role is required (owner, admin, member, viewer)'}), 400
    
    # Handle special owner ID format
    if str(member_id).startswith('owner_'):
        return jsonify({'error': 'Cannot change owner role'}), 403
    
    member = ProjectMember.query.filter_by(
        id=int(member_id), 
        roadmap_id=roadmap_id
    ).first_or_404()
    
    member.role = new_role
    db.session.commit()
    
    return jsonify({
        'id': member.id,
        'role': member.role,
        'updated_at': datetime.utcnow().isoformat()
    }), 200

# API to remove member from roadmap
@app.route('/api/roadmaps/<int:roadmap_id>/members/<member_id>', methods=['DELETE'])
@roadmap_access_required('admin')
def remove_member_from_roadmap(roadmap_id, member_id):
    # Handle special owner ID format
    if str(member_id).startswith('owner_'):
        return jsonify({'error': 'Cannot remove project owner'}), 403
    
    member = ProjectMember.query.filter_by(
        id=int(member_id), 
        roadmap_id=roadmap_id
    ).first_or_404()
    
    db.session.delete(member)
    db.session.commit()
    
    return jsonify({'message': 'Member removed successfully'}), 200

# Team Invitation Link APIs

# API to create team invitation link
@app.route('/api/roadmaps/<int:roadmap_id>/invitations', methods=['POST'])
@roadmap_access_required('admin')
def create_team_invitation(roadmap_id):
    data = request.json
    role = data.get('role', 'member')
    created_by = get_current_user().id
    expires_hours = data.get('expires_hours')
    max_uses = data.get('max_uses')
    
    if role not in ['admin', 'member', 'viewer']:
        return jsonify({'error': 'Invalid role specified'}), 400
    
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    
    # Generate unique invitation token
    invitation_token = secrets.token_urlsafe(32)
    
    # Calculate expiration if specified
    expires_at = None
    if expires_hours:
        expires_at = datetime.utcnow() + timedelta(hours=int(expires_hours))
    
    # Create invitation
    invitation = TeamInvitation(
        roadmap_id=roadmap_id,
        invitation_token=invitation_token,
        role=role,
        created_by=created_by,
        expires_at=expires_at,
        max_uses=max_uses
    )
    
    db.session.add(invitation)
    db.session.commit()
    
    # Generate invitation URL
    invitation_url = f"{request.host_url}join/{invitation_token}"
    
    return jsonify({
        'id': invitation.id,
        'invitation_url': invitation_url,
        'invitation_token': invitation_token,
        'role': invitation.role,
        'expires_at': invitation.expires_at.isoformat() if invitation.expires_at else None,
        'max_uses': invitation.max_uses,
        'current_uses': invitation.current_uses,
        'created_at': invitation.created_at.isoformat()
    }), 201

# API to get team invitation links
@app.route('/api/roadmaps/<int:roadmap_id>/invitations', methods=['GET'])
@roadmap_access_required('admin')
def get_team_invitations(roadmap_id):
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    
    invitations = TeamInvitation.query.filter_by(
        roadmap_id=roadmap_id, 
        is_active=True
    ).order_by(TeamInvitation.created_at.desc()).all()
    
    result = []
    for invitation in invitations:
        # Check if invitation is expired
        is_expired = invitation.expires_at and invitation.expires_at < datetime.utcnow()
        
        # Check if invitation is at max uses
        is_maxed = invitation.max_uses and invitation.current_uses >= invitation.max_uses
        
        result.append({
            'id': invitation.id,
            'invitation_url': f"{request.host_url}join/{invitation.invitation_token}",
            'role': invitation.role,
            'expires_at': invitation.expires_at.isoformat() if invitation.expires_at else None,
            'max_uses': invitation.max_uses,
            'current_uses': invitation.current_uses,
            'is_active': invitation.is_active and not is_expired and not is_maxed,
            'is_expired': is_expired,
            'created_at': invitation.created_at.isoformat(),
            'creator': {
                'id': invitation.creator.id,
                'username': invitation.creator.username,
                'full_name': invitation.creator.full_name
            } if invitation.creator else None
        })
    
    return jsonify(result), 200

# API to deactivate invitation link
@app.route('/api/roadmaps/<int:roadmap_id>/invitations/<int:invitation_id>', methods=['DELETE'])
@roadmap_access_required('admin')
def deactivate_team_invitation(roadmap_id, invitation_id):
    invitation = TeamInvitation.query.filter_by(
        id=invitation_id,
        roadmap_id=roadmap_id
    ).first_or_404()
    
    invitation.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'Invitation link deactivated'}), 200

# Public route to join team via invitation link
@app.route('/join/<invitation_token>')
def join_team_page(invitation_token):
    invitation = TeamInvitation.query.filter_by(
        invitation_token=invitation_token,
        is_active=True
    ).first_or_404()
    
    # Check if invitation is expired
    if invitation.expires_at and invitation.expires_at < datetime.utcnow():
        return render_template('error.html', 
                             error_title="Invitation Expired", 
                             error_message="This team invitation has expired."), 410
    
    # Check if invitation is at max uses
    if invitation.max_uses and invitation.current_uses >= invitation.max_uses:
        return render_template('error.html', 
                             error_title="Invitation Full", 
                             error_message="This invitation has reached its maximum number of uses."), 410
    
    roadmap = invitation.roadmap
    
    # Get Google Client ID from environment
    google_client_id = os.getenv('GOOGLE_CLIENT_ID', '')
    
    return render_template('join_team.html', 
                         invitation=invitation,
                         roadmap=roadmap,
                         invitation_token=invitation_token,
                         google_client_id=google_client_id)

# API to accept team invitation
@app.route('/api/join/<invitation_token>', methods=['POST'])
@limiter.limit("5 per minute")  # Prevent invitation abuse
def accept_team_invitation(invitation_token):
    data = request.json
    user_data = data.get('user')  # User info if registering new user
    google_user_data = data.get('google_user')  # Google user info
    existing_user_id = data.get('user_id')  # If user already exists
    
    invitation = TeamInvitation.query.filter_by(
        invitation_token=invitation_token,
        is_active=True
    ).first_or_404()
    
    # Check if invitation is still valid
    if invitation.expires_at and invitation.expires_at < datetime.utcnow():
        return jsonify({'error': 'Invitation has expired'}), 410
    
    if invitation.max_uses and invitation.current_uses >= invitation.max_uses:
        return jsonify({'error': 'Invitation has reached maximum uses'}), 410
    
    # Handle user - existing, new registration, or Google sign-in
    if existing_user_id:
        user = User.query.get_or_404(existing_user_id)
    elif google_user_data:
        # Handle Google sign-in
        email = google_user_data.get('email')
        full_name = google_user_data.get('full_name')
        google_id = google_user_data.get('google_id')
        avatar_url = google_user_data.get('avatar_url')
        
        # Normalize avatar URL - treat empty strings as None
        if avatar_url and avatar_url.strip() == '':
            avatar_url = None
        
        if not email or not google_id:
            return jsonify({'error': 'Google email and ID are required'}), 400
        
        # Check if user already exists by email or Google ID
        user = User.query.filter(
            (User.email == email) | (User.google_id == google_id)
        ).first()
        
        if user:
            # Update existing user with Google info if needed
            if not user.google_id:
                user.google_id = google_id
                user.auth_provider = 'google'
            if not user.full_name and full_name:
                user.full_name = full_name
            # Update avatar only if we have a valid URL and user doesn't have one
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            user.last_login = datetime.utcnow()
            db.session.commit()
        else:
            # Create new Google user
            # Generate username from email if not provided
            username_base = email.split('@')[0]
            username = username_base
            counter = 1
            while User.query.filter_by(username=username).first():
                username = f"{username_base}{counter}"
                counter += 1
            
            user = User(
                username=username,
                email=email,
                full_name=full_name or email.split('@')[0],
                google_id=google_id,
                auth_provider='google',
                avatar_url=avatar_url,
                last_login=datetime.utcnow()
            )
            
            db.session.add(user)
            db.session.commit()
    elif user_data:
        # Register new local user
        username = user_data.get('username')
        email = user_data.get('email')
        password = user_data.get('password')
        full_name = user_data.get('full_name', '')
        
        if not username or not email or not password:
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        # Check if user already exists
        if User.query.filter((User.username == username) | (User.email == email)).first():
            return jsonify({'error': 'User already exists'}), 409
        
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            full_name=full_name,
            auth_provider='local'
        )
        
        db.session.add(user)
        db.session.commit()
    else:
        return jsonify({'error': 'User information required'}), 400
    
    # Check if user is already a member
    existing_member = ProjectMember.query.filter_by(
        roadmap_id=invitation.roadmap_id,
        user_id=user.id
    ).first()
    
    if existing_member:
        return jsonify({'error': 'User is already a member of this project'}), 409
    
    # Add user to team
    member = ProjectMember(
        roadmap_id=invitation.roadmap_id,
        user_id=user.id,
        role=invitation.role,
        invited_by=invitation.created_by,
        joined_at=datetime.utcnow()
    )
    
    db.session.add(member)
    
    # Increment invitation usage
    invitation.current_uses += 1
    db.session.commit()
    
    # Log activity for the user joining
    log_user_activity(
        user_id=user.id,
        action_type='joined',
        target_type='roadmap',
        target_id=invitation.roadmap_id,
        target_name=invitation.roadmap.name,
        description=f"Joined roadmap '{invitation.roadmap.name}' as {invitation.role} via invitation",
        metadata={'role': invitation.role, 'via_invitation': True}
    )
    
    return jsonify({
        'message': 'Successfully joined the team!',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_url': user.avatar_url,
            'auth_provider': user.auth_provider
        },
        'role': member.role,
        'roadmap': {
            'id': invitation.roadmap.id,
            'name': invitation.roadmap.name
        }
    }), 200

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
@login_required
def roadmaps():
    user = get_current_user()
    
    # Get roadmaps where user is owner or member
    owned_roadmaps = Roadmap.query.filter_by(owner_id=user.id).all()
    
    member_roadmaps = db.session.query(Roadmap).join(
        ProjectMember, Roadmap.id == ProjectMember.roadmap_id
    ).filter(
        ProjectMember.user_id == user.id,
        ProjectMember.status == 'active'
    ).all()
    
    # Combine and deduplicate
    all_roadmaps = list({rm.id: rm for rm in owned_roadmaps + member_roadmaps}.values())
    
    return render_template('index.html', roadmaps=all_roadmaps)

@app.route('/roadmap')
def roadmap_root():
    return redirect(url_for('roadmaps'))

@app.route('/roadmap/<int:roadmap_id>')
@roadmap_access_required('view')
def roadmap(roadmap_id):
    # Fetch the roadmap by ID and pass its name to the template
    rm = Roadmap.query.get_or_404(roadmap_id)
    user = get_current_user()
    
    # Get user's role in this roadmap
    user_role = 'viewer'
    if rm.owner_id == user.id:
        user_role = 'owner'
    else:
        member = ProjectMember.query.filter_by(
            roadmap_id=roadmap_id, 
            user_id=user.id, 
            status='active'
        ).first()
        if member:
            user_role = member.role
    
    return render_template('roadmap.html', 
                         roadmap_id=roadmap_id, 
                         roadmap_name=rm.name,
                         user_role=user_role)

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
        demo_rm = Roadmap(
            name='Product Compass Demo',
            description='Experience the full power of Product Compass with this interactive demo showcasing all our key features.',
            is_public=True  # Make demo public
        )
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

    # Render the demo template directly (no authentication required)
    description = demo_rm.description or 'Experience the full power of Product Compass with this interactive demo showcasing all our key features.'
    return render_template('demo.html', 
                         roadmap_id=demo_rm.id, 
                         roadmap_name=demo_rm.name,
                         roadmap_description=description,
                         user_role='demo')

# Public API endpoint for demo data
@app.route('/api/demo/roadmap')
def get_demo_roadmap():
    # Get or create demo roadmap
    demo_rm = Roadmap.query.filter_by(name='Product Compass Demo').first()
    if not demo_rm:
        # Trigger demo creation if it doesn't exist
        demo()
        demo_rm = Roadmap.query.filter_by(name='Product Compass Demo').first()
    
    # Get features
    features = Feature.query.filter_by(roadmap_id=demo_rm.id).order_by(Feature.date).all()
    
    return jsonify({
        'roadmap': {
            'id': demo_rm.id,
            'name': demo_rm.name,
            'description': demo_rm.description,
            'is_demo': True
        },
        'features': [{
            'id': f.id,
            'title': f.title,
            'description': f.description,
            'priority': f.priority,
            'status': f.status,
            'release': f.release,
            'date': f.date.isoformat()
        } for f in features]
    }), 200

# Quick fix endpoint to update demo description
@app.route('/api/demo/fix-description', methods=['POST'])
def fix_demo_description():
    demo_rm = Roadmap.query.filter_by(name='Product Compass Demo').first()
    if demo_rm:
        demo_rm.description = 'Experience the full power of Product Compass with this interactive demo showcasing all our key features.'
        db.session.commit()
        return jsonify({'message': 'Demo description updated'}), 200
    return jsonify({'error': 'Demo roadmap not found'}), 404

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

@app.route('/features')
def features():
    return render_template('features.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/team')
def team():
    return render_template('team.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

# Contact form submission
@app.route('/api/contact', methods=['POST'])
@limiter.limit("2 per minute")  # Prevent contact form spam
def submit_contact_form():
    try:
        data = request.json
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        
        # Validate required fields
        if not name or not email or not subject or not message:
            return jsonify({'error': 'All fields are required'}), 400
        
        # Validate email format (basic check)
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Please provide a valid email address'}), 400
        
        # Email body for notification
        notification_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0056d2, #4f46e5); color: white; padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">New Contact Form Submission</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Product Compass Website</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 2rem; border-radius: 0 0 8px 8px;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-top: 0;">Contact Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666;">Name:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333;">{name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666;">Email:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333;">
                                <a href="mailto:{email}" style="color: #0056d2; text-decoration: none;">{email}</a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666;">Subject:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333;">{subject}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; font-weight: bold; color: #666; vertical-align: top;">Message:</td>
                            <td style="padding: 10px 0; color: #333;">
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #0056d2;">
                                    {message.replace(chr(10), '<br>')}
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 14px; margin: 0;">
                        This message was sent from the Product Compass contact form.<br>
                        <strong>Reply directly to {email} to respond to {name}.</strong>
                    </p>
                </div>
            </div>
        </div>
        """
        
        # Send notification email to admin with improved headers
        success1, error1 = send_mailgun_email(
            to_email=os.getenv('CONTACT_EMAIL', 'n.abbiw10@gmail.com'),
            subject=f"[Product Compass] New Contact: {subject}",
            html_content=notification_html,
            reply_to=email  # Set reply-to as the contact form submitter
        )
        
        if not success1:
            print(f"Error sending notification email: {error1}")
            return jsonify({
                'error': 'Sorry, there was an error sending your message. Please try again later.'
            }), 500
        
        # Confirmation email for sender
        confirmation_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0056d2, #4f46e5); color: white; padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">Thank You!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">We've received your message</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 2rem; border-radius: 0 0 8px 8px;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 0;">
                        Hi <strong>{name}</strong>,
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Thank you for reaching out to us! We've received your message about "<strong>{subject}</strong>" and 
                        we'll get back to you as soon as possible, usually within 24 hours.
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Here's a copy of your message for your records:
                    </p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #0056d2; margin: 20px 0;">
                        <p style="color: #555; margin: 0; font-style: italic;">
                            "{message}"
                        </p>
                    </div>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        In the meantime, feel free to explore our platform and create amazing product roadmaps!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 1.5rem;">
                    <a href="{request.host_url}" style="display: inline-block; background: #0056d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Visit Product Compass
                    </a>
                </div>
                
                <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 14px; margin: 0;">
                        Best regards,<br>
                        The Product Compass Team
                    </p>
                </div>
            </div>
        </div>
        """
        
        # Send confirmation email to the sender
        success2, error2 = send_mailgun_email(
            to_email=email,
            subject="Thank you for contacting Product Compass",
            html_content=confirmation_html
        )
        
        if not success2:
            print(f"Error sending confirmation email: {error2}")
            # Don't fail the request if confirmation email fails
        
        return jsonify({
            'success': True,
            'message': 'Thank you for your message! We\'ll get back to you soon.'
        }), 200
        
    except Exception as e:
        print(f"Error sending email: {e}")
        return jsonify({
            'error': 'Sorry, there was an error sending your message. Please try again later.'
        }), 500

@app.route('/personas')
def personas_view():
    return render_template('personas.html')

# ============ PUBLIC SHARING ROUTES ============

# Public shared roadmap view
@app.route('/share/<share_token>')
def shared_roadmap(share_token):
    link = ShareableLink.query.filter_by(share_token=share_token, is_active=True).first_or_404()
    
    # Check if link has expired
    if link.expires_at and link.expires_at < datetime.utcnow():
        return render_template('error.html', 
                             error_title="Link Expired", 
                             error_message="This shared link has expired."), 410
    
    # Handle password protection
    if link.password_protected:
        password = request.args.get('password')
        if not password or not check_password_hash(link.password_hash, password):
            return render_template('shared_password.html', share_token=share_token)
    
    # Track analytics
    track_link_visit(link.id, request)
    
    # Get roadmap data
    roadmap = Roadmap.query.get_or_404(link.roadmap_id)
    branding = json.loads(link.custom_branding) if link.custom_branding else {}
    
    return render_template('shared_roadmap.html', 
                         roadmap=roadmap,
                         link=link,
                         branding=branding,
                         share_token=share_token,
                         access_level=link.access_level)

# Embeddable roadmap view
@app.route('/embed/<share_token>')
def embed_roadmap(share_token):
    link = ShareableLink.query.filter_by(share_token=share_token, is_active=True).first_or_404()
    
    if not link.allow_embed:
        return "Embedding not allowed for this roadmap", 403
    
    # Check if link has expired
    if link.expires_at and link.expires_at < datetime.utcnow():
        return "This shared link has expired.", 410
    
    # Track analytics
    track_link_visit(link.id, request)
    
    # Get roadmap data
    roadmap = Roadmap.query.get_or_404(link.roadmap_id)
    branding = json.loads(link.custom_branding) if link.custom_branding else {}
    
    return render_template('embed_roadmap.html', 
                         roadmap=roadmap,
                         link=link,
                         branding=branding,
                         share_token=share_token)

# Password verification for protected links
@app.route('/share/<share_token>/verify', methods=['POST'])
@limiter.limit("10 per minute")  # Prevent password brute force
def verify_share_password(share_token):
    link = ShareableLink.query.filter_by(share_token=share_token, is_active=True).first_or_404()
    password = request.form.get('password')
    
    if check_password_hash(link.password_hash, password):
        return redirect(f"/share/{share_token}?password={password}")
    else:
        return render_template('shared_password.html', 
                             share_token=share_token, 
                             error="Incorrect password")

# API endpoint for shared roadmap data
@app.route('/api/share/<share_token>/data')
def get_shared_roadmap_data(share_token):
    link = ShareableLink.query.filter_by(share_token=share_token, is_active=True).first_or_404()
    
    # Check if link has expired
    if link.expires_at and link.expires_at < datetime.utcnow():
        return jsonify({'error': 'Link expired'}), 410
    
    # Handle password protection
    if link.password_protected:
        password = request.args.get('password')
        if not password or not check_password_hash(link.password_hash, password):
            return jsonify({'error': 'Password required'}), 401
    
    # Get roadmap and features
    roadmap = Roadmap.query.get_or_404(link.roadmap_id)
    features = Feature.query.filter_by(roadmap_id=link.roadmap_id).order_by(Feature.date).all()
    
    return jsonify({
        'roadmap': {
            'id': roadmap.id,
            'name': roadmap.name
        },
        'link': {
            'title': link.title,
            'description': link.description,
            'access_level': link.access_level,
            'custom_branding': json.loads(link.custom_branding) if link.custom_branding else {}
        },
        'features': [{
            'id': f.id,
            'title': f.title,
            'description': f.description,
            'priority': f.priority,
            'status': f.status,
            'release': f.release,
            'date': f.date.isoformat()
        } for f in features]
    }), 200

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

@app.route('/api/users/me/stats', methods=['GET'])
@login_required
def get_user_stats():
    user = get_current_user()
    
    # Get roadmaps where user is owner or member
    owned_roadmaps = Roadmap.query.filter_by(owner_id=user.id).all()
    
    member_roadmaps = db.session.query(Roadmap).join(
        ProjectMember, Roadmap.id == ProjectMember.roadmap_id
    ).filter(
        ProjectMember.user_id == user.id,
        ProjectMember.status == 'active'
    ).all()
    
    # Combine and deduplicate
    all_roadmaps = list({rm.id: rm for rm in owned_roadmaps + member_roadmaps}.values())
    
    # Count total features across all accessible roadmaps
    total_features = 0
    roadmap_ids = [rm.id for rm in all_roadmaps]
    if roadmap_ids:
        total_features = Feature.query.filter(Feature.roadmap_id.in_(roadmap_ids)).count()
    
    # Count teams (roadmaps where user is member but not owner)
    team_count = len([rm for rm in all_roadmaps if rm.owner_id != user.id])
    
    # Count owned roadmaps
    owned_count = len(owned_roadmaps)
    
    return jsonify({
        'roadmaps': len(all_roadmaps),
        'owned_roadmaps': owned_count,
        'teams': team_count,
        'features': total_features,
        'total_activities': UserActivity.query.filter_by(user_id=user.id).count()
    }), 200

# API to get all roadmaps
@app.route('/api/roadmaps', methods=['GET'])
@login_required
def get_roadmaps():
    user = get_current_user()
    
    # Get roadmaps where user is owner or member
    owned_roadmaps = Roadmap.query.filter_by(owner_id=user.id).all()
    
    member_roadmaps = db.session.query(Roadmap).join(
        ProjectMember, Roadmap.id == ProjectMember.roadmap_id
    ).filter(
        ProjectMember.user_id == user.id,
        ProjectMember.status == 'active'
    ).all()
    
    # Combine and deduplicate
    all_roadmaps = list({rm.id: rm for rm in owned_roadmaps + member_roadmaps}.values())
    
    # Add feature count and additional metadata
    roadmaps_data = []
    for r in all_roadmaps:
        feature_count = Feature.query.filter_by(roadmap_id=r.id).count()
        
        # Determine user's role
        if r.owner_id == user.id:
            role = 'Owner'
        else:
            member = ProjectMember.query.filter_by(
                roadmap_id=r.id, 
                user_id=user.id, 
                status='active'
            ).first()
            role = member.role.title() if member else 'Viewer'
        
        roadmaps_data.append({
            'id': r.id, 
            'name': r.name,
            'description': r.description,
            'is_owner': r.owner_id == user.id,
            'owner_id': r.owner_id,
            'role': role,
            'created_at': r.created_at.isoformat(),
            'updated_at': r.updated_at.isoformat(),
            'lastUpdated': r.updated_at.isoformat(),  # Add this for frontend compatibility
            'feature_count': feature_count,
            'featureCount': feature_count,  # Add this for frontend compatibility
            'is_public': r.is_public
        })
    
    return jsonify(roadmaps_data), 200

# API to update a roadmap
@app.route('/api/roadmaps/<int:roadmap_id>', methods=['PUT'])
@roadmap_access_required('admin')
def update_roadmap(roadmap_id):
    try:
        user = get_current_user()
        roadmap = Roadmap.query.get_or_404(roadmap_id)
        
        # Only the owner can edit the roadmap
        if roadmap.owner_id != user.id:
            return jsonify({'error': 'Only the roadmap owner can edit it'}), 403
        
        data = request.get_json()
        
        # Update allowed fields
        if 'name' in data:
            roadmap.name = data['name']
        if 'description' in data:
            roadmap.description = data['description']
        if 'is_public' in data:
            roadmap.is_public = data['is_public']
        
        roadmap.updated_at = datetime.utcnow()
        
        # Log activity
        log_user_activity(
            user_id=user.id,
            action_type='updated',
            target_type='roadmap',
            target_id=roadmap.id,
            target_name=roadmap.name,
            description=f"Updated roadmap '{roadmap.name}'"
        )
        
        db.session.commit()
        
        return jsonify({
            'message': 'Roadmap updated successfully',
            'roadmap': {
                'id': roadmap.id,
                'name': roadmap.name,
                'description': roadmap.description,
                'is_public': roadmap.is_public,
                'updated_at': roadmap.updated_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update roadmap: {str(e)}'}), 500

# API to duplicate a roadmap
@app.route('/api/roadmaps/<int:roadmap_id>/duplicate', methods=['POST'])
@roadmap_access_required('view')
def duplicate_roadmap(roadmap_id):
    try:
        user = get_current_user()
        original_roadmap = Roadmap.query.get_or_404(roadmap_id)
        
        data = request.get_json() or {}
        
        # Create new roadmap
        new_roadmap = Roadmap(
            name=data.get('name', f"{original_roadmap.name} (Copy)"),
            description=data.get('description', original_roadmap.description),
            owner_id=user.id,
            is_public=data.get('is_public', False)  # Default to private for duplicates
        )
        
        db.session.add(new_roadmap)
        db.session.flush()  # Get the ID
        
        # Copy all features from original roadmap
        original_features = Feature.query.filter_by(roadmap_id=roadmap_id).all()
        for feature in original_features:
            new_feature = Feature(
                title=feature.title,
                description=feature.description,
                priority=feature.priority,
                status=feature.status,
                release=feature.release,
                roadmap_id=new_roadmap.id,
                date=feature.date
            )
            db.session.add(new_feature)
        
        # Log activity
        log_user_activity(
            user_id=user.id,
            action_type='created',
            target_type='roadmap',
            target_id=new_roadmap.id,
            target_name=new_roadmap.name,
            description=f"Duplicated roadmap '{original_roadmap.name}' as '{new_roadmap.name}'"
        )
        
        db.session.commit()
        
        return jsonify({
            'message': 'Roadmap duplicated successfully',
            'roadmap': {
                'id': new_roadmap.id,
                'name': new_roadmap.name,
                'description': new_roadmap.description,
                'is_public': new_roadmap.is_public,
                'created_at': new_roadmap.created_at.isoformat(),
                'feature_count': len(original_features)
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to duplicate roadmap: {str(e)}'}), 500

# API to import a roadmap from CSV/JSON file
@app.route('/api/roadmaps/import', methods=['POST'])
@login_required
def import_roadmap():
    try:
        user = get_current_user()
        print(f"Import request from user: {user.id if user else 'None'}")
        print(f"Request headers: {dict(request.headers)}")
        print(f"Request content type: {request.content_type}")
        
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get additional form data
        roadmap_name = request.form.get('name', 'Imported Roadmap')
        roadmap_description = request.form.get('description', 'Imported from file')
        is_public = request.form.get('is_public', 'false').lower() == 'true'
        
        # Validate file type
        allowed_extensions = {'.csv', '.json', '.xlsx', '.xls'}
        file_ext = os.path.splitext(file.filename.lower())[1]
        if file_ext not in allowed_extensions:
            return jsonify({'error': 'Unsupported file type. Please use CSV, JSON, or Excel files.'}), 400
        
        # Read and parse file content
        features_data = []
        
        if file_ext == '.csv':
            # Parse CSV file
            content = file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(content))
            
            for row in csv_reader:
                # Map CSV columns to feature fields
                feature_data = {
                    'title': row.get('Title', row.get('title', row.get('Name', row.get('name', '')))),
                    'description': row.get('Description', row.get('description', '')),
                    'priority': row.get('Priority', row.get('priority', 'medium')).lower(),
                    'status': row.get('Status', row.get('status', 'planned')).lower(),
                    'release': row.get('Release', row.get('release', '')),
                    'date': row.get('Date', row.get('date', row.get('Due Date', row.get('due_date', ''))))
                }
                
                # Validate required fields
                if not feature_data['title']:
                    continue  # Skip rows without title
                
                # Parse and validate date
                if feature_data['date']:
                    try:
                        # Try multiple date formats
                        date_formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']
                        parsed_date = None
                        for fmt in date_formats:
                            try:
                                parsed_date = datetime.strptime(feature_data['date'], fmt).date()
                                break
                            except ValueError:
                                continue
                        
                        if parsed_date:
                            feature_data['date'] = parsed_date
                        else:
                            feature_data['date'] = datetime.today().date()  # Default to today
                    except:
                        feature_data['date'] = datetime.today().date()
                else:
                    feature_data['date'] = datetime.today().date()
                
                # Validate priority and status values
                valid_priorities = ['low', 'medium', 'high']
                if feature_data['priority'] not in valid_priorities:
                    feature_data['priority'] = 'medium'
                
                valid_statuses = ['planned', 'in-progress', 'completed']
                if feature_data['status'] not in valid_statuses:
                    feature_data['status'] = 'planned'
                
                features_data.append(feature_data)
        
        elif file_ext == '.json':
            # Parse JSON file
            content = file.read().decode('utf-8')
            json_data = json.loads(content)
            
            # Handle different JSON structures
            if isinstance(json_data, list):
                # Array of features
                features_list = json_data
            elif isinstance(json_data, dict):
                # Object with features array
                features_list = json_data.get('features', json_data.get('data', []))
                # Also check for roadmap metadata
                if 'name' in json_data and not request.form.get('name'):
                    roadmap_name = json_data['name']
                if 'description' in json_data and not request.form.get('description'):
                    roadmap_description = json_data['description']
            else:
                return jsonify({'error': 'Invalid JSON format'}), 400
            
            for item in features_list:
                if not isinstance(item, dict):
                    continue
                
                feature_data = {
                    'title': item.get('title', item.get('name', '')),
                    'description': item.get('description', ''),
                    'priority': str(item.get('priority', 'medium')).lower(),
                    'status': str(item.get('status', 'planned')).lower(),
                    'release': item.get('release', ''),
                    'date': item.get('date', item.get('due_date', ''))
                }
                
                # Validate and parse similar to CSV
                if not feature_data['title']:
                    continue
                
                # Parse date
                if feature_data['date']:
                    try:
                        if isinstance(feature_data['date'], str):
                            parsed_date = datetime.fromisoformat(feature_data['date'].replace('Z', '+00:00')).date()
                        else:
                            parsed_date = datetime.today().date()
                        feature_data['date'] = parsed_date
                    except:
                        feature_data['date'] = datetime.today().date()
                else:
                    feature_data['date'] = datetime.today().date()
                
                # Validate values
                valid_priorities = ['low', 'medium', 'high']
                if feature_data['priority'] not in valid_priorities:
                    feature_data['priority'] = 'medium'
                
                valid_statuses = ['planned', 'in-progress', 'completed']
                if feature_data['status'] not in valid_statuses:
                    feature_data['status'] = 'planned'
                
                features_data.append(feature_data)
        
        # Check if we have any valid features
        if not features_data:
            return jsonify({'error': 'No valid features found in the file'}), 400
        
        # Create new roadmap
        new_roadmap = Roadmap(
            name=roadmap_name,
            description=roadmap_description,
            owner_id=user.id,
            is_public=is_public
        )
        
        db.session.add(new_roadmap)
        db.session.flush()  # Get the ID
        
        # Create features
        created_features = []
        for feature_data in features_data:
            try:
                new_feature = Feature(
                    title=feature_data['title'],
                    description=feature_data['description'],
                    priority=feature_data['priority'],
                    status=feature_data['status'],
                    release=feature_data['release'],
                    roadmap_id=new_roadmap.id,
                    date=feature_data['date']
                )
                db.session.add(new_feature)
                created_features.append(new_feature)
            except Exception as e:
                print(f"Error creating feature: {e}")
                continue
        
        # Log activity
        log_user_activity(
            user_id=user.id,
            action_type='created',
            target_type='roadmap',
            target_id=new_roadmap.id,
            target_name=new_roadmap.name,
            description=f"Imported roadmap '{new_roadmap.name}' with {len(created_features)} features from {file_ext} file"
        )
        
        db.session.commit()
        
        return jsonify({
            'message': 'Roadmap imported successfully',
            'roadmap': {
                'id': new_roadmap.id,
                'name': new_roadmap.name,
                'description': new_roadmap.description,
                'is_public': new_roadmap.is_public,
                'created_at': new_roadmap.created_at.isoformat(),
                'feature_count': len(created_features)
            },
            'features_imported': len(created_features)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Import error: {e}")
        return jsonify({'error': f'Failed to import roadmap: {str(e)}'}), 500

# API to delete a roadmap
@app.route('/api/roadmaps/<int:roadmap_id>', methods=['DELETE'])
@login_required
def delete_roadmap(roadmap_id):
    try:
        user = get_current_user()
        roadmap = Roadmap.query.get_or_404(roadmap_id)
        
        # Only the owner can delete the roadmap
        if roadmap.owner_id != user.id:
            return jsonify({'error': 'Only the roadmap owner can delete it'}), 403
        
        # Log activity before deletion
        log_user_activity(
            user_id=user.id,
            action_type='deleted',
            target_type='roadmap',
            target_id=roadmap.id,
            target_name=roadmap.name,
            description=f"Deleted roadmap '{roadmap.name}'"
        )
        
        # Delete the roadmap (cascade will handle related records)
        db.session.delete(roadmap)
        db.session.commit()
        
        return jsonify({'message': 'Roadmap deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete roadmap: {str(e)}'}), 500

# API to delete user account
@app.route('/api/users/me', methods=['DELETE'])
@login_required
@limiter.limit("1 per hour")  # Prevent accidental multiple deletions
def delete_current_user_account():
    try:
        user = get_current_user()
        user_id = user.id
        username = user.username
        email = user.email
        
        # Delete in the correct order to avoid foreign key constraint issues
        
        # 1. Delete user activities first
        UserActivity.query.filter_by(user_id=user.id).delete()
        
        # 2. Delete project memberships where user is a member
        ProjectMember.query.filter_by(user_id=user.id).delete()
        
        # 3. Update project memberships where user invited others (set invited_by to NULL)
        ProjectMember.query.filter_by(invited_by=user.id).update({'invited_by': None})
        
        # 4. Delete team invitations created by this user
        TeamInvitation.query.filter_by(created_by=user.id).delete()
        
        # 5. Delete roadmaps owned by this user (this will cascade delete related features, shares, exports, etc.)
        owned_roadmaps = Roadmap.query.filter_by(owner_id=user.id).all()
        for roadmap in owned_roadmaps:
            # Delete features for this roadmap
            Feature.query.filter_by(roadmap_id=roadmap.id).delete()
            # Delete shareable links for this roadmap
            ShareableLink.query.filter_by(roadmap_id=roadmap.id).delete()
            # Delete export history for this roadmap
            ExportHistory.query.filter_by(roadmap_id=roadmap.id).delete()
            # Delete team invitations for this roadmap
            TeamInvitation.query.filter_by(roadmap_id=roadmap.id).delete()
            # Delete project members for this roadmap
            ProjectMember.query.filter_by(roadmap_id=roadmap.id).delete()
            # Delete the roadmap itself
            db.session.delete(roadmap)
        
        # 6. Finally delete the user account
        db.session.delete(user)
        
        # Commit all changes
        db.session.commit()
        
        # Clear session
        session.clear()
        
        return jsonify({
            'message': 'Account deleted successfully',
            'deleted_user': {
                'id': user_id,
                'username': username,
                'email': email
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete account: {str(e)}'}), 500

# Test endpoint for authentication debugging
@app.route('/api/test-auth', methods=['GET'])
@login_required
def test_auth():
    user = get_current_user()
    return jsonify({
        'authenticated': True,
        'user_id': user.id,
        'username': user.username,
        'email': user.email
    }), 200

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
        # Development settings
        app.run(
            host='127.0.0.1',
            port=5000,
            debug=True
        ) 