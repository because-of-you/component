#!/usr/bin/env bash

# author anjia0532@gmail.com
# blog https://anjia0532.github.io/
# github https://github.com/anjia0532

# this script depend on jq,check it first
RED='\033[0;31m'
NC='\033[0m' # No Color

if ! [ -x "$(command -v jq)" ]; then
  echo  -e "${RED}Error: jq is not installed.${NC}" >&2
  exit 1
fi

if ! [ -x "$(command -v openssl)" ]; then
  echo  -e "${RED}Error: openssl is not installed.${NC}" >&2
  exit 1
fi

if ! [ -x "$(command -v ~/.acme.sh/acme.sh)" ]; then
  echo  -e "${RED}Error: acme.sh is not installed.(doc https://github.com/acmesh-official/acme.sh/wiki/How-to-install)${NC}" >&2
  exit 1
fi

usage () { echo "Usage : $0 -h <apisix admin host> -p <certificate pem file> -k <certificate private key file> -a <admin api key> -t <print debug info switch off/on,default off>"; }

# parse args
API_PATH="/apisix/admin/ssls/"
while getopts "h:p:k:a:t:u:" opts; do
   case ${opts} in
      h) HOST=${OPTARG} ;;
      p) PEM=${OPTARG} ;;
      k) KEY=${OPTARG} ;;
      a) API_KEY=${OPTARG} ;;
      u) API_PATH=${OPTARG} ;;
      t) DEBUG=${OPTARG} ;;
      *) usage; exit;;
   esac
done

# those args must be not null
if [ ! "$HOST" ] || [ ! "$PEM" ] || [ ! "$KEY" ] || [ ! "$API_KEY" ]
then
    usage
    exit 1
fi

# optional args,set default value

[ -z "$DEBUG" ] && DEBUG=off

# print vars key and value when DEBUG eq on
[[ "on" == "$DEBUG" ]] && echo -e "HOST:${HOST} API_KEY:${API_KEY} PEM FILE:${PEM} KEY FILE:${KEY} DEBUG:${DEBUG} API_PATH:${API_PATH}"


# get all ssl and filter this one by sni name
cert_content=$(curl --silent --location --request GET "${HOST}${API_PATH}" \
--header "X-API-KEY: ${API_KEY}" \
--header 'Content-Type: application/json' | jq "first(.node.nodes[]| select(.value.snis[] | contains(\"$(openssl x509 -in $PEM -noout -text|grep -oP '(?<=DNS:|IP Address:)[^,]+'|sort|head -n1)\")))")


validity_start=$(date --date="$(openssl x509 -startdate -noout -in $PEM|cut -d= -f 2)" +"%s")
validity_end=$(date --date="$(openssl x509 -enddate -noout -in $PEM|cut -d= -f 2)" +"%s")

# create a new ssl when it not exist
if [ -z "$cert_content" ]
then
  cert_content="{\"snis\":[],\"status\": 1}"

  # read domains from pem file by openssl
  snis=$(openssl x509 -in $PEM -noout -text|grep -oP '(?<=DNS:|IP Address:)[^,]+'|sort)
  for sni in ${snis[@]} ; do
    cert_content=$(echo $cert_content | jq ".snis += [\"$sni\"]")
  done

  # cert_content=$(echo $cert_content | jq ".|.cert = \"$(cat $PEM)\"|.key = \"$(cat $KEY)\"|.validity_start=${validity_start}|.validity_end=${validity_end}")
  cert_content=$(echo $cert_content | jq ".|.cert = \"$(cat $PEM)\"|.key = \"$(cat $KEY)\"")

  cert_update_result=$(curl --silent --location --request POST "${HOST}${API_PATH}" \
  --header "X-API-KEY: ${API_KEY}" \
  --header 'Content-Type: application/json' \
  --data "$cert_content" )

  [[ "on" == "$DEBUG" ]] && echo -e "cert_content: \n${cert_content}\n\ncreate result json:\n\n${cert_update_result}"
else
  # get exist ssl id
  URI=$(echo $cert_content | jq -r ".key")
  ID=$(echo ${URI##*/})
  # get exist  ssl certificate json , modify cert and key value
  cert_content=$(echo $cert_content | jq ".value|.cert = \"$(cat $PEM)\"|.key = \"$(cat $KEY)\"|.id=\"${ID}\"|.update_time=$(date +'%s')|.validity_start=${validity_start}|.validity_end=${validity_end}")

  # update apisix ssl
  cert_update_result=$(curl --silent --location --request PUT "${HOST}${API_PATH}${ID}" \
  --header "X-API-KEY: ${API_KEY}" \
  --header 'Content-Type: application/json' \
  --data "$cert_content" )

  [[ "on" == "$DEBUG" ]] && echo -e "cert_content: \n${cert_content}\n\nupdate result json:\n\n${cert_update_result}"
fi

exit 0