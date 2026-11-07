const axios = require('axios');

/**
 * Send an OTP via SMS to a user's phone number.
 * Supports Twilio, Fast2SMS, and console logging fallback.
 */
async function sendOtpSms(phoneNumber, otp) {
  const cleanPhone = phoneNumber.replace(/\s+/g, '');

  // 1. Check Twilio configuration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams({
        From: twilioFrom,
        To: cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`,
        Body: `Your ResumeFlow verification code is: ${otp}. Valid for 10 minutes.`,
      });

      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        params.toString(),
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );
      console.log(`📱 Real SMS delivered via Twilio to ${cleanPhone}`);
      return true;
    } catch (err) {
      console.error('Twilio SMS error:', err.response?.data?.message || err.message);
    }
  }

  // 2. Check Fast2SMS configuration (popular free Indian SMS gateway)
  const fast2smsKey = process.env.FAST2SMS_API_KEY?.trim();
  if (fast2smsKey) {
    try {
      const numbers = cleanPhone.replace(/^\+91/, '').replace(/\D/g, '');
      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'otp',
          variables_values: otp,
          numbers: numbers,
        },
        {
          headers: { authorization: fast2smsKey },
          timeout: 10000,
        }
      );
      if (response.data?.return) {
        console.log(`📱 Real SMS delivered via Fast2SMS to ${cleanPhone}`);
        return true;
      }
    } catch (err) {
      console.error('Fast2SMS error:', err.response?.data?.message || err.message);
    }
  }

  // 3. Dev Fallback
  console.log(`\n📱 [SMS DEV LOG] OTP for ${cleanPhone}: ${otp}`);
  console.log('👉 To send real SMS to mobile inboxes, add TWILIO or FAST2SMS credentials in .env\n');
  return false;
}

module.exports = { sendOtpSms };

