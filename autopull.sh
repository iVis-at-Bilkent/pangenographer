#!/usr/bin/expect
# execute git pull and then enter username, personel access token using 'expect'
spawn ./gitpull.sh
expect -exact "Username for 'https://github.com': "
send -- "<username>\r"
expect -exact "Password for 'https://<username>@github.com':"
send -- "<password>\r"
expect eof
