const { getDB } = require("../database/db");
const { ObjectId } = require("mongodb");
const axios = require("axios");

/**
 * Create a new flashcard session
 */
exports.createFlashcardSession = async (req, res) => {
  const { sessionName, studyCards, transcript } = req.body;
  const userId = req.user.id;
  const accountType = req.user.accountType || "free";

  // Basic validation
  if (!sessionName || !Array.isArray(studyCards) || !transcript) {
    return res.status(400).json({
      error: "sessionName, studyCards, and transcript are required.",
    });
  }

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    // Enforce limit for free users
    if (accountType === "free") {
      const sessionCount = await flashcardsCollection.countDocuments({
        userId: new ObjectId(userId),
      });

      if (sessionCount >= 2) {
        return res.status(403).json({
          error:
            "You have reached the maximum number of study sessions allowed for free accounts.",
        });
      }
    }

    const newSession = {
      userId: new ObjectId(userId),
      studySession: sessionName,
      flashcardsJSON: studyCards,
      transcript: transcript,
      createdDate: new Date(),
      folderID: null,
    };

    const result = await flashcardsCollection.insertOne(newSession);

    // Include 'id' in the response for frontend consistency
    const createdSession = {
      id: result.insertedId.toString(),
      ...newSession,
    };

    res.status(201).json({
      message: "Flashcard session created successfully.",
      flashcard: createdSession,
    });
  } catch (error) {
    console.error("Create Flashcard Session Error:", error);
    res
      .status(500)
      .json({ error: "Server error while creating flashcard session." });
  }
};

/**
 * Add flashcards to an existing session
 */
exports.addFlashcardsToSession = async (req, res) => {
  const { id } = req.params;
  const { studyCards } = req.body;
  const userId = req.user.id;

  // Basic validation
  if (!Array.isArray(studyCards) || studyCards.length === 0) {
    return res
      .status(400)
      .json({ error: "studyCards (non-empty array) are required." });
  }

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    // Verify that the session exists and belongs to the user
    const session = await flashcardsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!session) {
      return res.status(404).json({ error: "Flashcard session not found." });
    }

    // Update the session by pushing new flashcards
    await flashcardsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $push: { flashcardsJSON: { $each: studyCards } } }
    );

    res
      .status(200)
      .json({ message: "Flashcards added successfully to the session." });
  } catch (error) {
    console.error("Add Flashcards Error:", error);
    res.status(500).json({ error: "Server error while adding flashcards." });
  }
};

/**
 * Retrieve all flashcard sessions for the logged-in user
 */
exports.getAllFlashcards = async (req, res) => {
  const userId = req.user.id;

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    const sessions = await flashcardsCollection
      .find({ userId: new ObjectId(userId) })
      .toArray();

    // Map sessions to a cleaner format
    const formattedSessions = sessions.map((session) => ({
      id: session._id.toString(),
      studySession: session.studySession,
      flashcardsJSON: session.flashcardsJSON,
      transcript: session.transcript,
      createdDate: session.createdDate,
    }));

    res.status(200).json({ flashcards: formattedSessions });
  } catch (error) {
    console.error("Get All Flashcards Error:", error);
    res
      .status(500)
      .json({ error: "Server error while retrieving flashcards." });
  }
};

/**
 * Retrieve a single flashcard session by ID
 */
exports.getFlashcardSessionById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    const session = await flashcardsCollection.findOne(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      {
        projection: {
          flashcardsJSON: 1,
          studySession: 1,
          transcript: 1,
          createdDate: 1,
        },
      }
    );

    if (!session) {
      return res.status(404).json({ error: "Flashcard session not found." });
    }

    res.status(200).json({
      id: session._id.toString(),
      studySession: session.studySession,
      flashcardsJSON: session.flashcardsJSON,
      transcript: session.transcript,
      createdDate: session.createdDate,
    });
  } catch (error) {
    console.error("Get Flashcard Session By ID Error:", error);
    res
      .status(500)
      .json({ error: "Server error while retrieving flashcard session." });
  }
};

/**
 * Delete a flashcard session by ID
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteFlashcardSession = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    // Verify that the session exists and belongs to the user
    const session = await flashcardsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!session) {
      return res.status(404).json({ error: "Flashcard session not found." });
    }

    // Delete the session
    await flashcardsCollection.deleteOne({ _id: new ObjectId(id) });

    res
      .status(200)
      .json({ message: "Flashcard session deleted successfully." });
  } catch (error) {
    console.error("Delete Flashcard Session Error:", error);
    res
      .status(500)
      .json({ error: "Server error while deleting flashcard session." });
  }
};

/**
 * Update the name of a flashcard session
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateFlashcardSessionName = async (req, res) => {
  const { id } = req.params;
  const { sessionName } = req.body;
  const userId = req.user.id;

  // Basic validation
  if (!sessionName) {
    return res.status(400).json({ error: "sessionName is required." });
  }

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    // Verify that the session exists and belongs to the user
    const session = await flashcardsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!session) {
      return res.status(404).json({ error: "Flashcard session not found." });
    }

    // Update the session name
    await flashcardsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { studySession: sessionName, updatedDate: new Date() } }
    );

    res
      .status(200)
      .json({ message: "Flashcard session name updated successfully." });
  } catch (error) {
    console.error("Update Flashcard Session Name Error:", error);
    res
      .status(500)
      .json({ error: "Server error while updating flashcard session name." });
  }
};

/**
 * Assign a folder to an existing flashcard session.
 */
exports.assignFolderToSession = async (req, res) => {
  const { id } = req.params;
  const { folderID } = req.body;
  const userId = req.user.id;

  if (!folderID) {
    return res.status(400).json({ error: "folderID is required." });
  }

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    // Verify that the session exists and belongs to the user
    const session = await flashcardsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });
    if (!session) {
      return res.status(404).json({ error: "Flashcard session not found." });
    }

    // Update the session to assign the folder
    await flashcardsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { folderID } }
    );

    res.status(200).json({ message: "Folder assigned successfully." });
  } catch (error) {
    console.error("Error assigning folder:", error);
    res.status(500).json({ error: "Server error assigning folder." });
  }
};

/**
 * Generate additional flashcards for an existing session
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateAdditionalFlashcards = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const accountType = req.user.accountType || "free";

  // Enforce premium requirement
  if (accountType === "free") {
    return res.status(403).json({
      error: "This feature is available for paid accounts only.",
    });
  }

  try {
    const db = getDB();
    const flashcardsCollection = db.collection("flashcards");

    // Verify that the session exists and belongs to the user
    const session = await flashcardsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!session) {
      return res.status(404).json({ error: "Flashcard session not found." });
    }

    const transcript = session.transcript;
    const existingQuestions = session.flashcardsJSON.map(
      (card) => card.question
    );

    // Generate new flashcards
    const newFlashcards = await generateFlashcards(
      transcript,
      existingQuestions
    );

    // Update the session by adding new flashcards
    await flashcardsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $push: { flashcardsJSON: { $each: newFlashcards } } }
    );

    res.status(200).json({
      message: "Additional flashcards generated and added successfully.",
      newFlashcards: newFlashcards,
    });
  } catch (error) {
    console.error("Generate Additional Flashcards Error:", error);
    res.status(500).json({
      error: "Server error while generating additional flashcards.",
    });
  }
};

/**
 * Helper function to generate flashcards using OpenAI API
 *
 * @param {string} transcript - The transcript text.
 * @param {Array} existingQuestions - Array of existing flashcard questions.
 * @returns {Array} - An array of new flashcards.
 */
async function generateFlashcards(transcript, existingQuestions) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const prompt = `
    Convert the following transcript into 10 more study flashcards in JSON format (return this as text, do NOT return this in markdown).
    Each flashcard should be an object with "question" and "answer" fields.
    Ensure that the flashcards cover the important information in the transcript.
    Do not duplicate already existing flashcards, these 10 new flashcards MUST cover new content and topics within the transcript that are not covered by the existing flashcards.

    Transcript:
    ${transcript}

    Already Existing Flashcards:
    ${existingQuestions.join("\n")}

    Provide the flashcards in the following JSON format:
    [
      {
        "question": "Question 1",
        "answer": "Answer 1"
      },
      {
        "question": "Question 2",
        "answer": "Answer 2"
      }
    ]

    Requirements:
      - Return only the JSON array of flashcards.
      - Do not include any extra text, explanations, or code snippets.
      - Do not use markdown formatting or code blocks.
      - Ensure the JSON is valid and can be parsed.
      - Generated flashcards MUST be in the same language as the transcript. If the transcript is a language other than English, generated output MUST be in that language.
      - Ignore information within the transcript pertaining to personnel or course structure. Flashcards are for educational content.
  `;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt.trim() }],
      max_tokens: 15000,
      temperature: 0.3,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
    }
  );

  // Process the response
  let flashcardsText = response.data.choices[0].message.content.trim();
  if (flashcardsText.startsWith("```") && flashcardsText.endsWith("```")) {
    flashcardsText = flashcardsText.slice(3, -3).trim();
  }

  let flashcards;
  try {
    flashcards = JSON.parse(flashcardsText);
  } catch (parseError) {
    console.error("Error parsing flashcards JSON:", parseError);
    throw new Error("Failed to parse flashcards JSON.");
  }

  // Validate the flashcards format
  if (
    !Array.isArray(flashcards) ||
    !flashcards.every(
      (card) =>
        typeof card === "object" &&
        typeof card.question === "string" &&
        typeof card.answer === "string"
    )
  ) {
    throw new Error("Invalid flashcards format received from OpenAI.");
  }

  return flashcards;
}
