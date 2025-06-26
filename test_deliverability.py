#!/usr/bin/env python3
"""
Email Deliverability Test Script
Tests various aspects of email delivery and provides recommendations.
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_mailgun_reputation():
    """Check Mailgun domain reputation and setup"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    domain = os.getenv('MAILGUN_DOMAIN')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    print("🔍 Checking Email Deliverability Setup")
    print("=" * 50)
    
    try:
        # Check domain info
        url = f"{base_url}/domains/{domain}"
        response = requests.get(url, auth=('api', api_key), timeout=10)
        
        if response.status_code == 200:
            domain_info = response.json()['domain']
            
            print(f"📍 Domain: {domain}")
            print(f"🔐 Type: {domain_info.get('type', 'unknown')}")
            print(f"📊 State: {domain_info.get('state', 'unknown')}")
            print(f"🛡️  TLS Required: {domain_info.get('require_tls', False)}")
            print(f"🔒 Spam Action: {domain_info.get('spam_action', 'unknown')}")
            print()
            
            # Check if it's a sandbox domain
            if domain_info.get('type') == 'sandbox':
                print("⚠️  SANDBOX DOMAIN DETECTED")
                print("📝 Sandbox domains have delivery limitations:")
                print("   • Can only send to authorized recipients")
                print("   • Higher chance of landing in spam")
                print("   • Not suitable for production use")
                print("   • Limited to 300 emails per day")
                print()
                print("💡 RECOMMENDATION: Add a custom domain for production")
                print("   1. Go to Mailgun Dashboard → Domains")
                print("   2. Add your domain (e.g., yourdomain.com)")
                print("   3. Set up DNS records (SPF, DKIM, DMARC)")
                print("   4. Update your .env file")
                print()
                return False
            else:
                print("✅ Custom domain detected - good for deliverability!")
                return True
                
        else:
            print(f"❌ Cannot check domain info: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking domain: {e}")
        return False

def check_dns_records():
    """Check if domain has proper DNS authentication"""
    
    domain = os.getenv('MAILGUN_DOMAIN')
    
    # For sandbox domains, skip DNS check
    if 'sandbox' in domain:
        print("ℹ️  Skipping DNS check for sandbox domain")
        return True
    
    print("🔍 Checking DNS Authentication Records")
    print("-" * 40)
    
    try:
        import subprocess
        
        # Check SPF record
        print("📧 Checking SPF record...")
        spf_result = subprocess.run(['nslookup', '-type=TXT', domain], 
                                  capture_output=True, text=True, timeout=10)
        
        if 'v=spf1' in spf_result.stdout:
            print("✅ SPF record found")
        else:
            print("❌ SPF record missing")
            
        # Check DKIM (Mailgun uses specific selector)
        print("🔐 Checking DKIM record...")
        dkim_domain = f"mailo._domainkey.{domain}"
        dkim_result = subprocess.run(['nslookup', '-type=TXT', dkim_domain], 
                                   capture_output=True, text=True, timeout=10)
        
        if 'v=DKIM1' in dkim_result.stdout:
            print("✅ DKIM record found")
        else:
            print("❌ DKIM record missing")
            
    except Exception as e:
        print(f"⚠️  Cannot check DNS records: {e}")
        print("💡 Manually verify DNS records in your domain registrar")

def get_deliverability_tips():
    """Provide deliverability improvement tips"""
    
    print("📈 Email Deliverability Tips")
    print("=" * 30)
    
    tips = [
        "✅ Use a custom domain (not sandbox) for production",
        "✅ Set up SPF, DKIM, and DMARC records",
        "✅ Include both HTML and text versions of emails",
        "✅ Use clear, descriptive subject lines",
        "✅ Avoid spam trigger words (FREE, URGENT, $$)",
        "✅ Include an unsubscribe link",
        "✅ Use a consistent 'From' name and address",
        "✅ Warm up your domain gradually",
        "✅ Monitor bounce and complaint rates",
        "✅ Authenticate your sender domain"
    ]
    
    for tip in tips:
        print(f"  {tip}")
    
    print()
    print("🎯 Immediate Actions for Better Delivery:")
    print("  1. Ask recipients to add you to their address book")
    print("  2. Send emails from a professional address")
    print("  3. Keep email content professional and relevant")
    print("  4. Test emails with different providers (Gmail, Outlook, Yahoo)")
    print("  5. Monitor email analytics in Mailgun dashboard")

def test_content_analysis():
    """Analyze email content for spam indicators"""
    
    print("\n📝 Email Content Analysis")
    print("-" * 30)
    
    # Sample content from your contact form
    sample_subject = "[Product Compass] New Contact: Test Subject"
    
    spam_words = ['free', 'urgent', 'limited time', 'act now', 'click here', 
                  'guaranteed', '100%', 'money back', 'no risk', 'winner']
    
    found_spam_words = [word for word in spam_words if word.lower() in sample_subject.lower()]
    
    if found_spam_words:
        print(f"⚠️  Potential spam words found: {', '.join(found_spam_words)}")
    else:
        print("✅ Subject line looks clean")
    
    print("💡 Content best practices:")
    print("  • Keep subject lines under 50 characters")
    print("  • Use a reasonable text-to-image ratio")
    print("  • Include a clear call-to-action")
    print("  • Personalize when possible")
    print("  • Avoid excessive caps or exclamation marks")

if __name__ == "__main__":
    print("🚀 Product Compass - Email Deliverability Test")
    print("=" * 60)
    
    # Check domain setup
    domain_ok = check_mailgun_reputation()
    
    # Check DNS if custom domain
    if domain_ok:
        check_dns_records()
    
    # Content analysis
    test_content_analysis()
    
    # General tips
    get_deliverability_tips()
    
    print("\n🎯 SUMMARY")
    print("=" * 20)
    if not domain_ok:
        print("❌ Using sandbox domain - upgrade recommended")
        print("🔗 Setup guide: https://documentation.mailgun.com/en/latest/user_manual.html#verifying-your-domain")
    else:
        print("✅ Domain setup looks good")
    
    print("\n📞 Next Steps:")
    print("1. Test send an email and check if it lands in inbox")
    print("2. Ask test recipients to check spam folder")
    print("3. Add emails to address book if found in spam")
    print("4. Monitor Mailgun dashboard for delivery stats") 