const fs = require('fs');
const path = require('path');
const CommunityPost = require('../models/CommunityPost');

const ACTIVITY_TYPES = ['pothole_fixing', 'drain_cleaning', 'garbage_cleanup', 'tree_planting', 'water_leak_repair', 'streetlight_repair', 'other'];

const removeFiles = (files = []) => files.forEach(f => f?.path && fs.unlink(f.path, () => {}));

// Shape a post for the client; `viewerId` decides hasAppreciated / canDelete.
const shape = (post, viewer) => {
  const p = post.toObject ? post.toObject() : post;
  const vid = viewer?._id ? String(viewer._id) : null;
  return {
    _id: p._id,
    userName: p.userName,
    activityType: p.activityType,
    caption: p.caption,
    images: p.images,
    location: p.location,
    gpsVerified: p.gpsVerified,
    appreciationCount: p.appreciationCount,
    hasAppreciated: !!vid && (p.appreciations || []).some(a => String(a) === vid),
    isMine: !!vid && String(p.user) === vid,
    canDelete: !!vid && (String(p.user) === vid || ['admin', 'manager'].includes(viewer.role)),
    createdAt: p.createdAt,
  };
};

// POST /api/community  (auth, multipart: images x2, caption, activityType, location JSON)
const createPost = async (req, res) => {
  const files = req.files || [];
  try {
    if (files.length !== 2) {
      removeFiles(files);
      return res.status(400).json({ success: false, message: 'Please upload exactly 2 photos (e.g. before and after).' });
    }

    const caption = String(req.body.caption || '').trim();
    if (caption.length < 3) {
      removeFiles(files);
      return res.status(400).json({ success: false, message: 'Please add a short caption.' });
    }

    let loc = {};
    try { loc = JSON.parse(req.body.location || '{}'); } catch { loc = {}; }
    const address = String(loc.address || '').trim();
    if (!address) {
      removeFiles(files);
      return res.status(400).json({ success: false, message: 'Please enter the location (area / landmark) of the work.' });
    }

    const lat = Number(loc.lat), lng = Number(loc.lng);
    const hasGps = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
    const activityType = ACTIVITY_TYPES.includes(req.body.activityType) ? req.body.activityType : 'other';

    const post = await CommunityPost.create({
      user: req.user._id,
      userName: req.user.name,
      activityType,
      caption: caption.slice(0, 280),
      images: files.map(f => `/uploads/community/${f.filename}`),
      location: {
        address: address.slice(0, 300),
        ...(hasGps && { lat, lng }),
        ...(hasGps && Number.isFinite(Number(loc.accuracy)) && { gpsAccuracy: Number(loc.accuracy) }),
      },
      gpsVerified: hasGps,
    });

    res.status(201).json({ success: true, post: shape(post, req.user) });
  } catch (error) {
    removeFiles(files);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/community?page=&limit=&type=&mine=true  (public; auth optional)
const getPosts = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit) || 9));
    const filter = { status: 'published' };
    if (ACTIVITY_TYPES.includes(req.query.type)) filter.activityType = req.query.type;
    if (req.query.mine === 'true' && req.user) filter.user = req.user._id;

    const sort = req.query.sort === 'top' ? { appreciationCount: -1, createdAt: -1 } : { createdAt: -1 };

    const [posts, total] = await Promise.all([
      CommunityPost.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      CommunityPost.countDocuments(filter),
    ]);

    res.json({
      success: true,
      posts: posts.map(p => shape(p, req.user)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/community/:id/appreciate  (auth) — toggles
const toggleAppreciation = async (req, res) => {
  try {
    const post = await CommunityPost.findOne({ _id: req.params.id, status: 'published' });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const already = post.appreciations.some(a => String(a) === String(req.user._id));
    const updated = await CommunityPost.findByIdAndUpdate(
      post._id,
      already
        ? { $pull: { appreciations: req.user._id }, $inc: { appreciationCount: -1 } }
        : { $addToSet: { appreciations: req.user._id }, $inc: { appreciationCount: 1 } },
      { new: true }
    );
    res.json({ success: true, hasAppreciated: !already, appreciationCount: Math.max(0, updated.appreciationCount) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/community/:id  (owner or admin/manager)
const deletePost = async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const isOwner = String(post.user) === String(req.user._id);
    if (!isOwner && !['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not allowed to delete this post' });
    }

    post.images.forEach(u => fs.unlink(path.join(__dirname, '..', u), () => {}));
    await post.deleteOne();
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createPost, getPosts, toggleAppreciation, deletePost };
