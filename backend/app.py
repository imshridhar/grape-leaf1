import os
import base64
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import bcrypt

from ml_model import (
    ALLOWED_EXTENSIONS,
    DEFAULT_MODEL_PATH,
    get_model_status,
    predict_leaf_image,
)

from grapes_yield import calculate_grapes_yield, VARIETY_PRESETS

BASE_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
FRONTEND_DIST = os.path.join(PROJECT_ROOT, 'frontend', 'dist')

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('SESSION_SECRET', 'grapeleaf-secret-key-2024')
CORS(app, supports_credentials=True, origins=['*'])

MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017')
client = MongoClient(MONGODB_URI)
db = client['grapeleaf_db2']
users_col = db['users']
predictions_col = db['predictions']
grapes_yield_col = db['grapes_yield_predictions']

MAX_IMAGE_BYTES = 10 * 1024 * 1024

DISEASE_INFO = {
    'black_rot': {
        'name': 'Black Rot',
        'description': 'A fungal disease caused by Guignardia bidwellii. Causes circular tan spots with dark borders on leaves and hard, black, mummified berries.',
        'severity': 'High',
        'solutions': [
            'Remove and destroy infected plant parts immediately',
            'Apply fungicides containing mancozeb, myclobutanil, or captan',
            'Ensure proper air circulation by pruning and training vines',
            'Avoid overhead irrigation to reduce leaf wetness',
            'Apply fungicide sprays during early bloom and 10-14 days after',
            'Clean up fallen leaves and fruit at season end'
        ],
        'prevention': [
            'Apply protective fungicides beginning at bud break',
            'Plant resistant grape varieties where possible',
            'Remove mummified fruit from previous season',
            'Maintain good canopy ventilation'
        ]
    },
    'esca': {
        'name': 'Esca',
        'description': 'A complex wood disease caused by multiple fungal pathogens. Causes tiger-stripe leaf patterns, premature defoliation, and internal wood decay.',
        'severity': 'Very High',
        'solutions': [
            'Remove and destroy severely affected vines',
            'Prune infected wood back to healthy tissue',
            'Apply wound protectants after pruning (Trichoderma-based)',
            'Avoid pruning during wet conditions',
            'Sterilize pruning tools between cuts',
            'Consider preventive trunk injections with phosphonate fungicides'
        ],
        'prevention': [
            'Protect pruning wounds immediately with sealants',
            'Prune during dry weather conditions',
            'Avoid large pruning wounds',
            'Disinfect tools with 70% alcohol between vines'
        ]
    },
    'healthy': {
        'name': 'Healthy',
        'description': 'The grape leaf shows no signs of disease. The vine is in excellent health with vibrant green color and no visible lesions or discoloration.',
        'severity': 'None',
        'solutions': [
            'Continue regular monitoring of vineyard health',
            'Maintain balanced fertilization program',
            'Ensure adequate irrigation without overwatering',
            'Perform preventive fungicide applications as recommended',
            'Keep records of vine health over the growing season'
        ],
        'prevention': [
            'Continue current management practices',
            'Regular scouting helps detect problems early',
            'Maintain proper canopy management for air circulation',
            'Monitor weather conditions for disease risk'
        ]
    },
    'leaf_blight': {
        'name': 'Leaf Blight',
        'description': 'Caused by Pseudocercospora vitis. Produces angular brown spots on leaves with yellow halos, leading to premature defoliation.',
        'severity': 'Medium',
        'solutions': [
            'Apply copper-based fungicides or mancozeb at first symptoms',
            'Remove and destroy heavily infected leaves',
            'Improve air circulation through proper canopy management',
            'Avoid overhead irrigation',
            'Apply fungicide sprays every 10-14 days during humid conditions',
            'Scout regularly and treat early before disease spreads'
        ],
        'prevention': [
            'Maintain good air circulation in the canopy',
            'Apply preventive copper-based fungicide sprays during humid weather',
            'Avoid wetting foliage when irrigating',
            'Ensure proper vine nutrition, especially potassium and calcium'
        ]
    }
}

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated


# ── PAGE ROUTES ──────────────────────────────────────────────────
# ── AUTH API ─────────────────────────────────────────────────────
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not name or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if users_col.find_one({'email': email}):
        return jsonify({'error': 'Email already registered'}), 409
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    uid = users_col.insert_one({'name': name, 'email': email, 'password': hashed, 'created_at': datetime.utcnow()}).inserted_id
    session['user_id'] = str(uid)
    session['user_name'] = name
    session['user_email'] = email
    return jsonify({'message': 'Registered successfully', 'user': {'name': name, 'email': email}}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    user = users_col.find_one({'email': email})
    if not user or not bcrypt.checkpw(password.encode(), user['password']):
        return jsonify({'error': 'Invalid email or password'}), 401
    session['user_id'] = str(user['_id'])
    session['user_name'] = user['name']
    session['user_email'] = email
    return jsonify({'message': 'Login successful', 'user': {'name': user['name'], 'email': email}})


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})


@app.route('/api/auth/me')
@login_required
def me():
    return jsonify({'user': {'name': session.get('user_name'), 'email': session.get('user_email')}})


@app.route('/api/model/status')
@login_required
def model_status():
    return jsonify(get_model_status(DEFAULT_MODEL_PATH))


# ── PREDICT API ──────────────────────────────────────────────────
@app.route('/api/predict', methods=['POST'])
@login_required
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'No image selected'}), 400
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Unsupported file type'}), 400
    image_data = file.read()
    if not image_data:
        return jsonify({'error': 'Image file is empty'}), 400
    if len(image_data) > MAX_IMAGE_BYTES:
        return jsonify({'error': 'Image too large (max 10MB)'}), 400

    try:
        prediction = predict_leaf_image(image_data, DEFAULT_MODEL_PATH)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    predicted_class = prediction['predicted_class']
    confidence = prediction['confidence']
    all_scores = prediction['all_scores']
    info = DISEASE_INFO[predicted_class]
    img_b64 = base64.b64encode(image_data).decode()
    img_mime = f'image/{ext}' if ext != 'jpg' else 'image/jpeg'

    doc = {
        'user_id': session['user_id'],
        'filename': file.filename,
        'image_data': img_b64,
        'image_mime': img_mime,
        'predicted_class': predicted_class,
        'disease_name': info['name'],
        'confidence': float(confidence),
        'all_scores': {k: float(v) for k, v in all_scores.items()},
        'severity': info['severity'],
        'description': info['description'],
        'solutions': info['solutions'],
        'prevention': info['prevention'],
        'model_source': prediction['model_source'],
        'model_version': prediction['model_version'],
        'image_quality': prediction['image_quality'],
        'created_at': datetime.utcnow()
    }
    rid = predictions_col.insert_one(doc).inserted_id

    return jsonify({
        'id': str(rid),
        'predicted_class': predicted_class,
        'disease_name': info['name'],
        'confidence': round(confidence * 100, 1),
        'severity': info['severity'],
        'description': info['description'],
        'solutions': info['solutions'],
        'prevention': info['prevention'],
        'all_scores': {k: round(v * 100, 1) for k, v in all_scores.items()},
        'model_source': prediction['model_source'],
        'model_version': prediction['model_version'],
        'image_quality': prediction['image_quality']
    })


# ── HISTORY API ──────────────────────────────────────────────────
@app.route('/api/history')
@login_required
def history():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    skip = (page - 1) * limit
    cursor = predictions_col.find(
        {'user_id': session['user_id']}, {'image_data': 0}
    ).sort('created_at', -1).skip(skip).limit(limit)
    total = predictions_col.count_documents({'user_id': session['user_id']})
    records = [{
        'id': str(d['_id']),
        'filename': d.get('filename', ''),
        'predicted_class': d['predicted_class'],
        'disease_name': d['disease_name'],
        'confidence': round(d['confidence'] * 100, 1),
        'severity': d['severity'],
        'created_at': d['created_at'].strftime('%b %d, %Y %H:%M')
    } for d in cursor]
    return jsonify({'records': records, 'total': total, 'page': page, 'pages': (total + limit - 1) // limit})


@app.route('/api/history/<pid>')
@login_required
def get_prediction(pid):
    try:
        doc = predictions_col.find_one({'_id': ObjectId(pid), 'user_id': session['user_id']})
    except Exception:
        return jsonify({'error': 'Invalid ID'}), 400
    if not doc:
        return jsonify({'error': 'Not found'}), 404
    
    image_src = f"data:{doc['image_mime']};base64,{doc['image_data']}" if doc.get('image_data') else ""

    res = {
        'id': str(doc['_id']),
        'filename': doc.get('filename', ''),
        'predicted_class': doc.get('predicted_class', ''),
        'disease_name': doc.get('disease_name', ''),
        'confidence': round(doc.get('confidence', 1.0) * 100, 1),
        'severity': doc.get('severity', ''),
        'description': doc.get('description', ''),
        'solutions': doc.get('solutions', []),
        'prevention': doc.get('prevention', []),
        'all_scores': {k: round(v * 100, 1) for k, v in doc.get('all_scores', {}).items()} if isinstance(doc.get('all_scores'), dict) else {},
        'model_source': doc.get('model_source', 'grapes_yield_engine'),
        'model_version': doc.get('model_version', '1.0'),
        'image_quality': doc.get('image_quality', {}),
        'image_data': image_src,
        'created_at': doc['created_at'].strftime('%B %d, %Y at %H:%M'),
        'record_type': doc.get('record_type', 'disease_detection'),
        'full_yield_result': doc.get('full_yield_result')
    }
    return jsonify(res)


@app.route('/api/history/<pid>', methods=['DELETE'])
@login_required
def delete_prediction(pid):
    try:
        r = predictions_col.delete_one({'_id': ObjectId(pid), 'user_id': session['user_id']})
    except Exception:
        return jsonify({'error': 'Invalid ID'}), 400
    if r.deleted_count == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'message': 'Deleted successfully'})


@app.route('/api/stats')
@login_required
def stats():
    uid = session['user_id']
    total = predictions_col.count_documents({'user_id': uid})
    pipeline = [{'$match': {'user_id': uid}}, {'$group': {'_id': '$predicted_class', 'count': {'$sum': 1}}}]
    class_counts = {i['_id']: i['count'] for i in predictions_col.aggregate(pipeline)}
    avg_res = list(predictions_col.aggregate([{'$match': {'user_id': uid}}, {'$group': {'_id': None, 'avg': {'$avg': '$confidence'}}}]))
    avg_conf = round(avg_res[0]['avg'] * 100, 1) if avg_res else 0
    recent = list(predictions_col.find({'user_id': uid}, {'image_data': 0}).sort('created_at', -1).limit(5))
    return jsonify({
        'total_predictions': total,
        'class_distribution': class_counts,
        'avg_confidence': avg_conf,
        'recent_predictions': [{
            'id': str(r['_id']),
            'disease_name': r['disease_name'],
            'predicted_class': r['predicted_class'],
            'confidence': round(r['confidence'] * 100, 1),
            'severity': r['severity'],
            'created_at': r['created_at'].strftime('%b %d, %Y')
        } for r in recent]
    })


@app.route('/api/predict/grapes-yield', methods=['POST'])
@login_required
def predict_grapes_yield():
    try:
        payload = request.get_json() or {}
        result = calculate_grapes_yield(payload)

        # Store prediction in MongoDB if authenticated user
        user_id = session.get('user_id')
        if user_id:
            try:
                record = {
                    'user_id': user_id,
                    'created_at': datetime.utcnow(),
                    'predicted_class': 'grapes_yield',
                    'disease_name': f"Grapes Yield: {result['yield_summary']['total_yield_tons']} Tons ({result['inputs']['variety']})",
                    'filename': f"{result['inputs']['variety']} ({result['inputs']['farm_area']} {result['inputs']['area_unit']})",
                    'confidence': float(result['yield_summary']['confidence_score']) / 100.0,
                    'severity': result['quality_assessment']['grade'],
                    'description': f"Forecasted total yield of {result['yield_summary']['total_yield_tons']} Tons ({result['yield_summary']['yield_per_acre_tons']} Tons/Acre) with expected net profit of ₹{result['financials']['expected_profit']:,.2f}.",
                    'solutions': result['action_plans']['seven_day_plan'],
                    'prevention': [f"Irrigation: {result['recommendations']['irrigation']}", f"Fertigation: {result['recommendations']['fertigation']}"],
                    'all_scores': {result['inputs']['variety']: 1.0},
                    'image_mime': 'image/png',
                    'image_data': '',
                    'record_type': 'grapes_yield',
                    'full_yield_result': result
                }
                inserted = predictions_col.insert_one(record)
                result['history_id'] = str(inserted.inserted_id)

                # Backup insert into grapes_yield_col
                grapes_yield_col.insert_one({
                    'user_id': user_id,
                    'created_at': record['created_at'],
                    'variety': result['inputs']['variety'],
                    'farm_area': result['inputs']['farm_area'],
                    'area_unit': result['inputs']['area_unit'],
                    'expected_yield_tons': result['yield_summary']['total_yield_tons'],
                    'expected_revenue': result['financials']['expected_revenue'],
                    'expected_profit': result['financials']['expected_profit'],
                    'quality_grade': result['quality_assessment']['grade'],
                    'full_result': result
                })
            except Exception as mongo_err:
                print('MongoDB yield record insert error:', mongo_err)

        return jsonify(result)
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/predict/grapes-yield/presets', methods=['GET'])
def get_grapes_yield_presets():
    return jsonify({
        'status': 'success',
        'varieties': list(VARIETY_PRESETS.keys()),
        'presets': VARIETY_PRESETS
    })


@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'GrapeGuard Disease Detection',
        'model': get_model_status(DEFAULT_MODEL_PATH)
    })


@app.route('/assets/<path:filename>')
def react_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_DIST, 'assets'), filename)


@app.route('/')
@app.route('/<path:path>')
def react_app(path=''):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(FRONTEND_DIST, 'index.html')
    return jsonify({
        'error': 'React build not found',
        'build_command': 'From the project root run: cd frontend && npm install && npm run build'
    }), 503


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
