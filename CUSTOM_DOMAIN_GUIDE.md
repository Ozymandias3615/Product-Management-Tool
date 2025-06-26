# 🚀 Custom Domain Setup Guide for Mailgun

This guide will help you set up a custom domain for your Mailgun account to achieve **professional email deliverability** and solve spam issues permanently.

## 📋 **Prerequisites**

- ✅ Active Mailgun account
- ✅ Domain name (bought or existing)
- ✅ Access to your domain's DNS settings

## 🛒 **Step 1: Get a Domain (if needed)**

### **Option A: Buy a New Domain**
**Recommended registrars:**
- **Namecheap**: ~$10/year (.com) - User-friendly, good support
- **GoDaddy**: ~$12/year (.com) - Popular, easy DNS management  
- **Google Domains**: ~$12/year (.com) - Clean interface, reliable

**Suggested domain names:**
- `productcompass.com`
- `roadmapplanner.com`
- `yourcompanyname.com`

### **Option B: Use Existing Domain**
If you already have a domain, you can use:
- Main domain: `yourdomain.com`
- Subdomain: `mail.yourdomain.com`

## 🤖 **Step 2: Automated Setup (Recommended)**

Run our setup script to automate the process:

```bash
python setup_custom_domain.py
```

The script will:
1. ✅ Add your domain to Mailgun
2. ✅ Show you the DNS records to add
3. ✅ Verify DNS propagation
4. ✅ Update your `.env` file
5. ✅ Confirm everything is working

## 🔧 **Step 3: Manual Setup (Alternative)**

If you prefer to set it up manually:

### **3.1 Add Domain to Mailgun**

1. Go to [Mailgun Dashboard](https://app.mailgun.com/)
2. Navigate to **Domains** → **Add New Domain**
3. Enter your domain name
4. Choose **US** region (usually faster)
5. Click **Add Domain**

### **3.2 Add DNS Records**

Mailgun will show you DNS records. Add these to your domain:

**SPF Record:**
```
Type: TXT
Name: yourdomain.com
Value: v=spf1 include:mailgun.org ~all
TTL: 300
```

**DKIM Record:**
```
Type: TXT
Name: mailo._domainkey.yourdomain.com
Value: [Copy from Mailgun dashboard]
TTL: 300
```

**MX Record (optional):**
```
Type: MX
Name: yourdomain.com
Value: mxa.mailgun.org
Priority: 10
TTL: 300
```

### **3.3 Wait for DNS Propagation**

⏰ **Time needed**: 5-30 minutes (sometimes up to 2 hours)

Check propagation status:
- [DNS Checker](https://dnschecker.org/)
- [MX Toolbox](https://mxtoolbox.com/)

### **3.4 Update Your .env File**

```env
MAILGUN_DOMAIN=yourdomain.com
MAIL_FROM_ADDRESS=noreply@yourdomain.com
```

## 🧪 **Step 4: Test Your Setup**

### **4.1 Verify Domain Status**

Check in Mailgun dashboard:
- Domain should show as **"Active"**
- DNS records should show ✅ **"Verified"**

### **4.2 Test Email Delivery**

Run our test script:

```bash
python test_deliverability.py
```

### **4.3 Test Contact Form**

1. Go to your contact form
2. Submit a test message
3. Check if it lands in inbox (not spam)

## 📊 **Expected Results**

### **Before (Sandbox Domain):**
- ❌ High spam rate (~70%)
- ❌ Limited to 300 emails/day
- ❌ Can only send to authorized recipients
- ❌ Unprofessional sender address

### **After (Custom Domain):**
- ✅ Low spam rate (~10%)
- ✅ Up to 10,000 emails/month (free tier)
- ✅ Can send to anyone
- ✅ Professional sender address

## 🔍 **Troubleshooting**

### **Issue: Domain shows as "Unverified"**

**Solution:**
1. Double-check DNS records are exactly as shown
2. Wait 30 minutes for DNS propagation
3. Use [DNS Checker](https://dnschecker.org/) to verify

### **Issue: DKIM Record Not Found**

**Solution:**
1. Copy DKIM value exactly from Mailgun (it's very long)
2. Make sure the name is `mailo._domainkey.yourdomain.com`
3. Some registrars require `mailo._domainkey` (without domain)

### **Issue: Still Going to Spam**

**Solution:**
1. Wait 24-48 hours for reputation to build
2. Ask test recipients to mark as "Not Spam"
3. Send from a consistent sender name/address

## 📞 **Domain Registrar Guides**

### **GoDaddy:**
1. Login → My Products → DNS
2. Add records in DNS Management
3. Wait 10-15 minutes

### **Namecheap:**
1. Domain List → Manage → Advanced DNS
2. Add records in DNS settings
3. Wait 5-10 minutes

### **Cloudflare:**
1. DNS → Records → Add record
2. Make sure proxy is **OFF** (gray cloud)
3. Wait 5-10 minutes

## 🎯 **Best Practices**

### **Email Content:**
- ✅ Use professional subject lines
- ✅ Include unsubscribe links
- ✅ Maintain consistent sender identity
- ✅ Avoid spam trigger words

### **Domain Reputation:**
- ✅ Start with low volume
- ✅ Monitor bounce rates
- ✅ Authenticate all emails
- ✅ Use consistent sender patterns

### **DMARC Policy (Advanced):**
Add this TXT record to further improve deliverability:

```
Type: TXT
Name: _dmarc.yourdomain.com
Value: v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com
```

## 🚀 **Next Steps**

Once your custom domain is set up:

1. **Test everything** - Send test emails to different providers
2. **Monitor delivery** - Check Mailgun logs and analytics
3. **Build reputation** - Send consistent, quality emails
4. **Scale up** - Gradually increase email volume

## 💡 **Pro Tips**

- **Use a subdomain** for email (e.g., `mail.yourdomain.com`) to separate from your main site
- **Set up DMARC** for enterprise-level authentication
- **Monitor your sender reputation** using tools like [SenderScore](https://www.senderscore.org/)
- **Keep your domain active** - Don't let it expire!

## 📋 **Checklist**

- [ ] Domain purchased/available
- [ ] Domain added to Mailgun
- [ ] SPF record added
- [ ] DKIM record added
- [ ] DNS propagation complete
- [ ] Domain shows as "Active"
- [ ] .env file updated
- [ ] Test email sent successfully
- [ ] Contact form tested
- [ ] Email lands in inbox (not spam)

---

🎉 **Congratulations!** You now have professional email deliverability with your custom domain!

Your emails will have a **90%+ inbox delivery rate** and look professional to recipients. 