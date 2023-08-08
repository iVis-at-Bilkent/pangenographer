#!/usr/bin/expect
# execute git pull and then enter username, personel access token using 'expect'
spawn ./gitpull.sh
expect -exact "Username for 'https://github.com': "
send -- "gorkemsolun\r"
expect -exact "Password for 'https://gorkemsolun@github.com':"
send -- "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\r"
expect eof
