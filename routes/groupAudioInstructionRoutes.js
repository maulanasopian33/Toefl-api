const express = require("express");
const router = express.Router();
const controller = require("../controllers/groupAudioInstructionController");

router.get("/group/:groupId", controller.getByGroup);
router.post("/", controller.create);
router.delete("/:id", controller.remove);

module.exports = router;
