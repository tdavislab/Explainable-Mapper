from flask import Flask, session
from flask_session import Session
import os
import uuid
from routes.mapper_routes import mapper_routes
from routes.trajectory_routes import trajectory_routes
from routes.data_routes import data_routes
from routes.explanation_routes import explanation_routes
from routes.select_detail_routes import select_detail_routes
from routes.other_routes import other_routes
from routes.helper_routes import helper_routes
from user_manager import update_session_activity

app = Flask(__name__)

# Session configuration — one Flask session cookie per browser client
app.config['SECRET_KEY'] = os.environ.get(
    'FLASK_SECRET_KEY',
    'dev-only-secret-key-change-me-before-public-release'
)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
Session(app)

@app.before_request
def before_request():
    """Assign a stable per-browser user_id used to isolate in-memory app state."""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
        print(f"New user session: {session['user_id']}")

@app.after_request
def after_request(response):
    user_id = session.get('user_id')
    if user_id:
        update_session_activity(user_id)
    return response

# Register blueprints
app.register_blueprint(mapper_routes)
app.register_blueprint(trajectory_routes)
app.register_blueprint(data_routes)
app.register_blueprint(explanation_routes)
app.register_blueprint(select_detail_routes)
app.register_blueprint(helper_routes)
app.register_blueprint(other_routes)

if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    # threaded=True allows concurrent requests from multiple users
    app.run(debug=debug, port=5005, host='0.0.0.0', threaded=True)
