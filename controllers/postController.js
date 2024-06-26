const Article = require('../models/articleModel');
const Journal = require('../models/journalModel');
const Reviewer = require('../models/reviewerModel');
const Auth = require('../models/authModel');
const nodemailer = require("nodemailer");
const JSZip = require('jszip');
const fs = require('fs');


/**
 * Add a new journal article.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.userId - The user ID.
 * @param {string} req.body.title - The title of the journal article.
 * @param {string} req.body.abstract - The abstract of the journal article.
 * @param {string[]} req.body.keywords - The keywords of the journal article.
 * @param {string} req.file.filename - The filename of the journal article file.
 * @param {string[]} req.body.authors - The authors of the journal article.
 * @param {string} req.body.journalId - The ID of the journal.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the journal article is added.
 */
const addArticle = async (req, res) => {
    try {
        const article = new Article({
            userId: req.body.userId,
            title: req.body.title,
            abstract: req.body.abstract,
            keywords: JSON.parse(req.body.keywords),
            file: req.file.filename,
            authors: JSON.parse(req.body.authors),
            journalId: req.body.journalId,
        });
        const responseData = await article.save();
        res.status(201).json({ success: true, message: "Article submitted successfully", data: responseData });
    } catch (error) {
        res.status(404).json({ success: false, message: "Article submission failed", error: error });
    }
}

/**
 * Retrieves journal articles data for a user.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} The response object with the retrieved journal articles data.
 */
const getArticle = async (req, res) => {
    try {
        const articles = await Article.find({ userId: req.user._id });
        const otherArticles = await Article.find({ 'authors.email': req.user.email });
        if (articles.length === 0 && otherArticles.length === 0) {
            return res.status(404).json({ success: false, message: "You didn't submit any journal article" });
        }
        res.status(200).json({ success: true, message: "Journal Articles data retrieved successfully", data: articles.concat(otherArticles.filter(item2 => !articles.some(item1 => item1.id === item2.id))) });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal Articles data retrieval failed", error: error });
    }
}

/**
 * Add a new journal entry.
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body containing the journal details.
 * @param {string} req.body.editorId - The ID of the editor creating the journal entry.
 * @param {string} req.body.title - The title of the journal entry.
 * @param {string} req.body.description - The description of the journal entry.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the journal is added successfully.
 */
const addJournal = async (req, res) => {
    try {
        const journal = new Journal({
            title: req.body.title,
            description: req.body.description,
        });
        const responseData = await journal.save();
        res.status(201).json({ success: true, message: "Journal added successfully", data: responseData });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal addition failed", error: error });
    }
}

const deleteJournal = async (req, res) => {
    try {
        const journalData = await Journal.findByIdAndDelete(req.params.journalId);
        if (!journalData) {
            return res.status(404).json({ success: false, message: "Journal not found" });
        }
        if (journalData.editorId) await Auth.findByIdAndDelete(journalData.editorId);
        res.status(200).json({ success: true, message: "Journal deleted successfully" });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal deletion failed", error: error });
    }
}

/**
 * Retrieves the list of journals.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the list of journals is retrieved.
 */
const getJournalList = async (req, res) => {
    try {
        const journalData = await Journal.find().populate('editorId', 'firstName lastName email');
        res.status(200).json({ success: true, message: "Journal data retrieved successfully", data: journalData.map(journal => ({ ...journal.toObject(), editor: journal.editorId, editorId: journal.editorId ? journal.editorId._id : null })) });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal data retrieval failed", error: error });
    }
}

/**
 * Sends an email using the provided information.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the email is sent.
 */
const sendMail = async (req, res) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_HOST,
            pass: process.env.EMAIL_HOST_PASSWORD,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: req.body.mailFrom + " <" + process.env.EMAIL_HOST + ">",
            to: req.body.mailTo,
            subject: req.body.mailSubject,
            // text: req.body.mailText,
            html: req.body.mailHtml,
        });

        if (info) {
            res.status(200).json({ success: true, message: "Mail sent successfully", data: info });
        } else {
            res.status(400).json({ success: false, message: "Mail sending failed", data: info });
        }
    } catch (error) {
        res.status(400).json({ success: false, message: "Mail sending failed", error: error });
    }
}

/**
 * Retrieves a list of journal articles based on the provided journal ID.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves once the articles are retrieved.
 */
const getArticleList = async (req, res) => {
    try {
        const articles = await Article.find({ journalId: req.params.journalId });
        if (articles.length === 0) {
            return res.status(404).json({ success: false, message: "No journal articles found" });
        }
        res.status(200).json({ success: true, message: "Journal Articles data retrieved successfully", data: articles });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal Articles data retrieval failed", error: error });
    }
}

const updateArticle = async (req, res) => {
    try {
        const article = await Article.findByIdAndUpdate(req.body._id, req.body, { new: true });
        if (!article) {
            return res.status(404).json({ success: false, message: "Journal article not found" });
        }
        res.status(200).json({ success: true, message: "Journal article updated successfully", data: article });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal article update failed", error: error });
    }
}

/**
 * Updates a journal article review.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the review is updated.
 */
const updateReview = async (req, res) => {
    try {
        const article = await Article.findById(req.body._id);
        if (!article) {
            return res.status(404).json({ success: false, message: "Journal article not found" });
        }
        const reviewerIndex = article.reviewers.findIndex(reviewer => reviewer.email === req.user.email);
        article.reviewers[reviewerIndex] = req.body.reviewers[0];
        await article.save();
        res.status(200).json({ success: true, message: "Journal article updated successfully" });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal article update failed", error: error });
    }
}

const addReviewer = async (req, res) => {
    const reviewerData = await Reviewer.findOne({ email: req.body.email });
    if (reviewerData) {
        return res.status(400).json({ success: false, message: "Reviewer already exists" });
    };
    try {
        const reviewer = new Reviewer({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            affiliation: req.body.affiliation,
        })
        const responseData = await reviewer.save();
        await Auth.findOneAndUpdate({ email: req.body.email }, { $set: { isReviewer: true } }, { new: true });
        res.status(201).json({ success: true, message: "Reviewer added successfully", data: responseData });
    } catch (error) {
        res.status(404).json({ success: false, message: "Reviewer addition failed", error: error });
    }
}

const addBulkReviewer = async (req, res) => {
    try {
        const responseData = await Reviewer.insertMany(req.body);
        res.status(201).json({ success: true, message: "Reviewers added successfully", data: responseData });
    } catch (error) {
        res.status(404).json({ success: false, message: "Reviewers addition failed", error: error });
    }
}

const getReviewerList = async (req, res) => {
    try {
        const reviewerData = await Reviewer.find();
        res.status(200).json({ success: true, message: "Reviewer data retrieved successfully", data: reviewerData });
    } catch (error) {
        res.status(404).json({ success: false, message: "Reviewer data retrieval failed", error: error });
    }
}

const getReviewArticles = async (req, res) => {
    try {
        const articles = await Article.find({ 'reviewers.email': req.user.email }).select('title createdAt file reviewers');
        if (articles.length === 0) {
            return res.status(404).json({ success: false, message: "No review articles found" });
        }
        const filteredArticles = articles.map(article => ({
            ...article.toObject(),
            reviewers: article.reviewers.filter(reviewer => reviewer.email === req.user.email)
        }));
        res.status(200).json({ success: true, message: "Journal Articles data retrieved successfully", data: filteredArticles });
    } catch (error) {
        res.status(404).json({ success: false, message: "Journal Articles data retrieval failed", error: error });
    }
}

const deleteReviewer = async (req, res) => {
    try {
        const reviewerData = await Reviewer.findByIdAndDelete(req.params.reviewerId);
        if (!reviewerData) {
            return res.status(404).json({ success: false, message: "Reviewer not found" });
        }
        await Auth.findOneAndUpdate({ email: reviewerData.email }, { $set: { isReviewer: false } }, { new: true });
        res.status(200).json({ success: true, message: "Reviewer deleted successfully" });
    } catch (error) {
        res.status(404).json({ success: false, message: "Reviewer deletion failed", error: error });
    }
}

const createZip = async (req, res) => {
    const zip = new JSZip();
    try {
        const files = req.body.files;
        files.forEach(file => {
            zip.file(file, fs.readFileSync(`public/journals/upload/${file}`));
        });
        const filename = new Date().getTime();
        zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream(`public/journals/zip/${filename}.zip`))
            .on('finish', function () {
                res.status(200).json({ success: true, message: "Zip file created successfully", filename: `${filename}.zip` });
            });

        setTimeout(() => {
            fs.unlinkSync(`public/journals/zip/${filename}.zip`);
        }, 60000);
    } catch (error) {
        res.status(404).json({ success: false, message: "Zip file creation failed", error: error });
    }
}

const addEditor = async (req, res) => {
    try {
        const user = await Auth.findOne({ email: req.body.email });
        if (user) {
            return res.status(400).json({ success: false, message: "Editor already exists" });
        }
        const userPhone = await Auth.findOne({ phoneNumber: req.body.phoneNumber });
        if (userPhone) {
            return res.status(400).json({ success: false, message: "Phone number already exists" });
        }
        const password = Math.random().toString(36).toUpperCase().slice(-10);
        const userName = req.body.firstName.toLowerCase() + Math.floor(Math.random() * 1000);
        const editor = await Auth({
            firstName: req.body.firstName,
            middleName: req.body.middleName,
            lastName: req.body.lastName,
            userName: userName,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            password: password,
            gender: req.body.gender,
            isEditor: true
        });
        await editor.save();
        await Journal.findByIdAndUpdate(req.body.journalId, { editorId: editor._id }, { new: true });
        res.status(201).json({ success: true, message: "Editor added successfully", data: { password, userName } });
    } catch (error) {
        res.status(404).json({ success: false, message: "Editor addition failed", error: error });
    }
}

const removeEditor = async (req, res) => {
    try {
        const journal = await Journal.findById(req.params.journalId);
        if (!journal) {
            return res.status(404).json({ success: false, message: "Journal not found" });
        }
        await Auth.findByIdAndDelete(journal.editorId);
        await Journal.findByIdAndUpdate(req.params.journalId, { editorId: null }, { new: true });
        res.status(200).json({ success: true, message: "Editor removed successfully" });
    } catch (error) {
        res.status(404).json({ success: false, message: "Editor removal failed", error: error });
    }
}

module.exports = {
    addArticle,
    getArticle,
    sendMail,
    getJournalList,
    addJournal,
    deleteJournal,
    getArticleList,
    updateArticle,
    addReviewer,
    addBulkReviewer,
    getReviewerList,
    getReviewArticles,
    updateReview,
    deleteReviewer,
    createZip,
    addEditor,
    removeEditor
}