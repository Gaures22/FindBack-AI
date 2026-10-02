"""
FindBack AI - Python Microservice for AI Lost & Found Item Matching
---------------------------------------------------------------------
Provides semantic text similarity (TF-IDF Cosine), image feature analysis (Pillow/Histogram),
metadata signal comparison, and composite scoring for potential lost-found matches.
"""

import os
import re
import math
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Try importing sklearn for TF-IDF; if unavailable, fallback to pure Python vectorizer
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# Try importing Pillow for image analysis
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def clean_text(text):
    """Normalize text by converting to lowercase and removing punctuation."""
    if not text:
        return ""
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return ' '.join(text.split())


def calculate_text_similarity(text1, text2):
    """
    Calculate semantic text similarity between two text descriptions using TF-IDF
    or pure Python word overlap fallback.
    """
    t1 = clean_text(text1)
    t2 = clean_text(text2)

    if not t1 or not t2:
        return 0.0

    if SKLEARN_AVAILABLE:
        try:
            vectorizer = TfidfVectorizer(stop_words='english')
            tfidf_matrix = vectorizer.fit_transform([t1, t2])
            sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            return float(round(sim, 4))
        except Exception:
            pass

    # Pure Python Jaccard & Term Frequency Fallback
    words1 = set(t1.split())
    words2 = set(t2.split())
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    jaccard = len(intersection) / float(len(union))
    return float(round(jaccard, 4))


def calculate_image_similarity(img_path1, img_path2):
    """
    Calculate image similarity score using Pillow color histogram matching.
    If image path is missing or invalid, returns default neutral score.
    """
    if not img_path1 or not img_path2:
        return 0.50  # Neutral fallback when image not provided

    if not PIL_AVAILABLE:
        # Simple file name similarity fallback
        if os.path.basename(img_path1) == os.path.basename(img_path2):
            return 0.95
        return 0.50

    try:
        # Resolve full path if relative upload path
        base_dir = os.path.dirname(os.path.abspath(__file__))
        path1 = os.path.join(base_dir, img_path1.lstrip('/')) if not os.path.isabs(img_path1) else img_path1
        path2 = os.path.join(base_dir, img_path2.lstrip('/')) if not os.path.isabs(img_path2) else img_path2

        if not os.path.exists(path1) or not os.path.exists(path2):
            # If path ends match
            if os.path.basename(img_path1) == os.path.basename(img_path2):
                return 0.90
            return 0.50

        im1 = Image.open(path1).convert('RGB').resize((128, 128))
        im2 = Image.open(path2).convert('RGB').resize((128, 128))

        # Compare color histograms
        h1 = im1.histogram()
        h2 = im2.histogram()

        # Cosine similarity between histogram vectors
        dot = sum(a * b for a, b in zip(h1, h2))
        norm1 = math.sqrt(sum(a * a for a in h1))
        norm2 = math.sqrt(sum(b * b for b in h2))

        if norm1 > 0 and norm2 > 0:
            sim = dot / (norm1 * norm2)
            return float(round(sim, 4))
        return 0.50
    except Exception as e:
        print(f"[AI Image Error] {e}")
        return 0.50


def calculate_metadata_similarity(target, candidate):
    """
    Compare category, color, and location metadata.
    Returns composite metadata score and a list of human-readable matching reasons.
    """
    reasons = []

    # Category matching (Weight: 40%)
    target_cat = (target.get('category') or '').strip().lower()
    cand_cat = (candidate.get('category') or '').strip().lower()
    if target_cat and cand_cat and target_cat == cand_cat:
        cat_score = 1.0
        reasons.append(f"Category match: {target.get('category')}")
    else:
        cat_score = 0.0

    # Colour matching (Weight: 30%)
    target_col = (target.get('colour') or '').strip().lower()
    cand_col = (candidate.get('colour') or '').strip().lower()
    if target_col and cand_col:
        if target_col == cand_col:
            col_score = 1.0
            reasons.append(f"Colour match: {target.get('colour')}")
        elif target_col in cand_col or cand_col in target_col:
            col_score = 0.70
            reasons.append(f"Similar colour palette: {target.get('colour')} / {candidate.get('colour')}")
        else:
            col_score = 0.0
    else:
        col_score = 0.50  # Neutral if missing

    # Location matching (Weight: 30%)
    target_loc = clean_text(target.get('location') or '')
    cand_loc = clean_text(candidate.get('location') or '')
    if target_loc and cand_loc:
        loc_words_target = set(target_loc.split())
        loc_words_cand = set(cand_loc.split())
        overlap = loc_words_target.intersection(loc_words_cand)

        if target_loc == cand_loc:
            loc_score = 1.0
            reasons.append(f"Exact location match: {target.get('location')}")
        elif len(overlap) > 0:
            loc_score = 0.75
            reasons.append(f"Nearby location match: {candidate.get('location')}")
        else:
            loc_score = 0.20
    else:
        loc_score = 0.50

    metadata_score = (cat_score * 0.40) + (col_score * 0.30) + (loc_score * 0.30)
    return float(round(metadata_score, 4)), reasons


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "service": "FindBack AI Matching Service",
        "sklearn_available": SKLEARN_AVAILABLE,
        "pil_available": PIL_AVAILABLE
    })


@app.route('/match', methods=['POST'])
def match_items():
    """
    Main AI Matching Endpoint:
    Receives target item (Lost or Found) and candidate items list.
    Computes text, image, and metadata similarity, ranks results, and returns matches.
    """
    data = request.json or {}
    target = data.get('target_item')
    candidates = data.get('candidate_items', [])

    if not target or not candidates:
        return jsonify({"status": "error", "message": "target_item and candidate_items are required", "matches": []}), 400

    target_text = f"{target.get('title', '')} {target.get('description', '')}"

    results = []

    for candidate in candidates:
        cand_text = f"{candidate.get('title', '')} {candidate.get('description', '')}"

        # 1. Text Similarity
        text_score = calculate_text_similarity(target_text, cand_text)

        # 2. Image Similarity
        image_score = calculate_image_similarity(target.get('image_url'), candidate.get('image_url'))

        # 3. Metadata Signals
        meta_score, meta_reasons = calculate_metadata_similarity(target, candidate)

        # 4. Combined Final Score
        # Weights: 40% Text, 30% Image, 30% Metadata
        final_score = (text_score * 0.40) + (image_score * 0.30) + (meta_score * 0.30)
        final_score = float(round(final_score, 4))

        # Build list of reasons
        reasons = list(meta_reasons)
        if text_score >= 0.50:
            reasons.append(f"High text similarity ({int(text_score * 100)}%)")
        elif text_score >= 0.25:
            reasons.append(f"Moderate text similarity ({int(text_score * 100)}%)")

        if image_score >= 0.70:
            reasons.append(f"High visual similarity ({int(image_score * 100)}%)")

        # Potential match threshold = 40% (0.40)
        is_potential = final_score >= 0.35

        results.append({
            "candidate_id": candidate.get('id'),
            "text_score": text_score,
            "image_score": image_score,
            "metadata_score": meta_score,
            "final_score": final_score,
            "is_potential_match": is_potential,
            "reasons": reasons
        })

    # Rank candidate matches in descending order of final score
    results.sort(key=lambda x: x['final_score'], reverse=True)

    return jsonify({
        "status": "success",
        "target_id": target.get('id'),
        "total_candidates": len(candidates),
        "matches": results
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 FindBack AI Service starting on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
