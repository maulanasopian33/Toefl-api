const { groupAudioInstruction } = require("../models");

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
    res.status(201).json(newAudio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const audios = await groupAudioInstruction.findAll({
      where: { groupId },
      order: [["id", "ASC"]],
    });
    res.json(audios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const audio = await groupAudioInstruction.findByPk(id);
    if (!audio) return res.status(404).json({ error: "Audio not found" });

    await audio.destroy();
    res.json({ message: "Audio deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
