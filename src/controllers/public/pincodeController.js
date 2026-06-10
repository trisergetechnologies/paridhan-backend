const PINCODE_API = "https://api.postalpincode.in/pincode";

export const lookupPincode = async (req, res) => {
  try {
    const pin = String(req.params.pin || "").replace(/\D/g, "");
    if (pin.length !== 6) {
      return res.status(200).json({
        success: false,
        message: "Enter a valid 6-digit PIN code",
        data: null,
      });
    }

    const upstream = await fetch(`${PINCODE_API}/${pin}`);
    const payload = await upstream.json().catch(() => []);
    const block = Array.isArray(payload) ? payload[0] : null;

    if (!block || block.Status !== "Success" || !block.PostOffice?.length) {
      return res.status(200).json({
        success: false,
        message: "Delivery not available to this PIN code yet",
        data: { pin, serviceable: false },
      });
    }

    const offices = block.PostOffice;
    const primary = offices[0];
    const districts = [...new Set(offices.map((o) => o.District).filter(Boolean))];
    const states = [...new Set(offices.map((o) => o.State).filter(Boolean))];

    return res.status(200).json({
      success: true,
      message: "PIN code found",
      data: {
        pin,
        serviceable: true,
        city: primary.District || primary.Name,
        state: primary.State,
        districts,
        states,
        postOffices: offices.slice(0, 5).map((o) => ({
          name: o.Name,
          district: o.District,
          state: o.State,
          deliveryStatus: o.DeliveryStatus,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};
