import {
  deleteImageKitFile,
  getUploadAuthParams,
  isImageKitConfigured,
} from "../../services/imagekitService.js";

export const postUploadAuth = async (req, res) => {
  try {
    if (!isImageKitConfigured()) {
      return res.status(200).json({
        success: false,
        message: "ImageKit is not configured (set IMAGEKIT_PUBLIC_KEY and IMAGEKIT_PRIVATE_KEY)",
        data: null,
      });
    }
    const data = getUploadAuthParams();
    return res.status(200).json({
      success: true,
      message: "Upload authentication parameters",
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const postDeleteFile = async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId || typeof fileId !== "string") {
      return res.status(200).json({ success: false, message: "fileId required", data: null });
    }
    if (!isImageKitConfigured()) {
      return res.status(200).json({ success: false, message: "ImageKit not configured", data: null });
    }
    const { ok } = await deleteImageKitFile(fileId.trim());
    return res.status(200).json({
      success: ok,
      message: ok ? "File deleted" : "ImageKit delete failed or file missing",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
