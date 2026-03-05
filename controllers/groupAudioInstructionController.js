const { groupAudioInstruction } = require("../models");
const { getCache, setCache, deleteCache } = require("../services/cache.service");

const AUDIO_CACHE_KEY = (groupId) => `audio:group:${groupId}`;
const CACHE_TTL = 3600; // 1 jam

exports.create = async (req, res) => {
  try {
    const { idInstruction, groupId, audioUrl, description, order } = req.body;
    const newAudio = await groupAudioInstruction.create({
      idInstruction,
      groupId,
      audioUrl,
      description,
      order,
    });

    // Invalidasi cache grup terkait
    await deleteCache(AUDIO_CACHE_KEY(groupId));

    res.status(201).json(newAudio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const cached = await getCache(AUDIO_CACHE_KEY(groupId));
    if (cached) {
      return res.set('X-Cache', 'HIT').json(cached);
    }

    const audios = await groupAudioInstruction.findAll({
      where: { groupId },
      order: [["id", "ASC"]],
    });

    await setCache(AUDIO_CACHE_KEY(groupId), audios, CACHE_TTL);
    res.set('X-Cache', 'MISS').json(audios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const audio = await groupAudioInstruction.findByPk(id);
    if (!audio) return res.status(404).json({ error: "Audio not found" });

    const groupId = audio.groupId;
    await audio.destroy();

    // Invalidasi cache grup terkait
    await deleteCache(AUDIO_CACHE_KEY(groupId));

    res.json({ message: "Audio deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
